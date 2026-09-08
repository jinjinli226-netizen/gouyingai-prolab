import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const {
  autoDlCreateUrl,
  autoDlResultUrl,
  buildAutoDlWorkflowRequest,
  normalizeAutoDlTask,
  parseUnifiedVideoInput,
} = await import("../src/autodl-comfyui.ts");
const { createLocalGatewayApp } = await import("../src/local-server.ts");
const { createGatewayApp } = await import("../src/server.ts");
const { encryptSecret } = await import("../src/encryption.ts");
const { LocalStore } = await import("../src/local-store.ts");

const modelOptions = {
  autodl: {
    workflowId: "minimax_h3_lightx2v_v5",
    requestTemplate: {
      prompt: "{{prompt}}",
      images: "{{referenceImages}}",
      duration: "{{duration}}",
      resolution: "{{resolution}}",
      metadata: { label: "job-{{prompt}}", keep_audio: "{{keepAudio}}" },
    },
    durationMap: { "15": 15 },
    resolutionMap: { "768": "768p竖" },
    minReferenceImages: 1,
    maxReferenceImages: 2,
    constants: { keepAudio: false },
  },
};

test("AutoDL request templates preserve typed placeholders", () => {
  const request = buildAutoDlWorkflowRequest(modelOptions, {
    prompt: "stable product",
    duration: "15",
    resolution: "768",
    referenceImages: ["data:image/png;base64,AAA", "https://cdn.test/person.png"],
    referenceAudios: [],
    size: "720x1280",
  });

  assert.equal(request.workflowId, "minimax_h3_lightx2v_v5");
  assert.deepEqual(request.body, {
    prompt: "stable product",
    images: ["data:image/png;base64,AAA", "https://cdn.test/person.png"],
    duration: 15,
    resolution: "768p竖",
    metadata: { label: "job-stable product", keep_audio: false },
  });
});

test("AutoDL request templates expand indexed reference images and omit unused slots", () => {
  const request = buildAutoDlWorkflowRequest(
    {
      autodl: {
        workflowId: "minimax_h3_lightx2v_v5",
        requestTemplate: {
          duration: "{{duration}}",
          prompt: "{{prompt}}",
          ref_image_0: "{{referenceImage0}}",
          ref_image_1: "{{referenceImage1}}",
          ref_image_2: "{{referenceImage2}}",
          resolution: "{{resolution}}",
        },
        durationMap: { "10": 10 },
        resolutionMap: { "720": "768p竖" },
        minReferenceImages: 1,
        maxReferenceImages: 9,
      },
    },
    {
      prompt: "new cast, stable product",
      duration: "10",
      resolution: "720",
      referenceImages: ["data:image/png;base64,AAA", "https://cdn.test/person.webp"],
      referenceAudios: [],
      size: "720x1280",
    },
  );

  assert.deepEqual(request.body, {
    duration: 10,
    prompt: "new cast, stable product",
    ref_image_0: "data:image/png;base64,AAA",
    ref_image_1: "https://cdn.test/person.webp",
    resolution: "768p竖",
  });
});

test("AutoDL request validation rejects incomplete or unsupported input", () => {
  assert.throws(
    () => buildAutoDlWorkflowRequest(modelOptions, { prompt: "x", duration: "15", resolution: "768", referenceImages: [] }),
    /参考图至少 1 张/,
  );
  assert.throws(
    () => buildAutoDlWorkflowRequest(modelOptions, { prompt: "", duration: "15", resolution: "768", referenceImages: [] }),
    /提示词/,
  );
  assert.throws(
    () =>
      buildAutoDlWorkflowRequest(modelOptions, {
        prompt: "x",
        duration: "15",
        resolution: "768",
        referenceImages: ["one", "two", "three"],
      }),
    /参考图最多 2 张/,
  );
  assert.throws(
    () => buildAutoDlWorkflowRequest(modelOptions, { prompt: "x", duration: "99", resolution: "768", referenceImages: ["one"] }),
    /时长 99/,
  );
  assert.throws(
    () => buildAutoDlWorkflowRequest(modelOptions, { prompt: "x", duration: "15", resolution: "1080", referenceImages: ["one"] }),
    /分辨率 1080/,
  );
});

test("AutoDL templates expand audio slots, optional prompts, and aspect-aware resolution", () => {
  const request = buildAutoDlWorkflowRequest(
    {
      autodl: {
        workflowId: "minimax_h3_image_audio_to_video_v2_15s",
        requestTemplate: {
          duration: "{{duration}}",
          ref_image_0: "{{referenceImage0}}",
          ref_audio_0: "{{referenceAudio0}}",
          resolution: "{{resolution}}",
        },
        durationMap: { "15": 15 },
        resolutionMap: { "720p|horizontal": "768p横", "720p": "768p竖" },
        minReferenceImages: 1,
        maxReferenceImages: 9,
        minReferenceAudios: 1,
        maxReferenceAudios: 3,
        promptRequired: false,
      },
    },
    {
      prompt: "",
      duration: "15",
      resolution: "720p",
      size: "1600x900",
      referenceImages: ["image"],
      referenceAudios: ["audio"],
    },
  );

  assert.deepEqual(request.body, {
    duration: 15,
    ref_image_0: "image",
    ref_audio_0: "audio",
    resolution: "768p横",
  });
});

test("AutoDL exact zero limits reject media that a workflow cannot accept", () => {
  assert.throws(
    () => buildAutoDlWorkflowRequest(
      {
        autodl: {
          workflowId: "minimax_h3_lightx2v_no_pic",
          requestTemplate: { prompt: "{{prompt}}", duration: "{{duration}}", resolution: "{{resolution}}" },
          durationMap: { "5": 5 },
          resolutionMap: { "720p": "768p竖" },
          maxReferenceImages: 0,
          maxReferenceAudios: 0,
        },
      },
      { prompt: "x", duration: "5", resolution: "720p", size: "720x1280", referenceImages: ["image"], referenceAudios: [] },
    ),
    /参考图最多 0 张/,
  );
});

test("AutoDL task envelopes normalize states and video results", () => {
  assert.deepEqual(normalizeAutoDlTask({ data: { task_id: "task-1", status: "QUEUED", results: [] } }), {
    upstreamTaskId: "task-1",
    status: "queued",
  });
  assert.deepEqual(normalizeAutoDlTask({ data: { task_id: "task-1", status: "RUNNING", results: [] } }), {
    upstreamTaskId: "task-1",
    status: "in_progress",
  });
  assert.deepEqual(
    normalizeAutoDlTask({ data: { task_id: "task-1", status: "SUCCESS", results: [{ url: "https://cdn.test/out.mp4" }] } }),
    { upstreamTaskId: "task-1", status: "completed", resultUrl: "https://cdn.test/out.mp4" },
  );
  assert.deepEqual(normalizeAutoDlTask({ data: { task_id: "task-1", status: "FAILED", message: "bad input" } }), {
    upstreamTaskId: "task-1",
    status: "failed",
    error: "bad input",
  });
  assert.deepEqual(normalizeAutoDlTask({ code: "Failure", msg: "quota exhausted" }), {
    status: "failed",
    error: "quota exhausted",
  });
});

test("AutoDL SUCCESS without a video is a failed normalized task", () => {
  assert.deepEqual(normalizeAutoDlTask({ data: { task_id: "task-1", status: "SUCCESS", results: [] } }), {
    upstreamTaskId: "task-1",
    status: "failed",
    error: "AutoDL 任务成功但没有返回视频文件",
  });
});

test("AutoDL URLs do not receive OpenAI v1 normalization", () => {
  assert.equal(
    autoDlCreateUrl("https://autodl.art/api/v1/comfyui/", "minimax_h3_lightx2v_v5"),
    "https://autodl.art/api/v1/comfyui/comfyui_workflow/minimax_h3_lightx2v_v5",
  );
  assert.equal(
    autoDlResultUrl("https://autodl.art/api/v1/comfyui/", "task/with spaces"),
    "https://autodl.art/api/v1/comfyui/comfyui_workflow/result/task%2Fwith%20spaces",
  );
});

test("AutoDL parses the existing multipart video request", async () => {
  const form = new FormData();
  form.append("model", "autodl-minimax-h3-multi-reference");
  form.append("prompt", "replace the cast");
  form.append("seconds", "15");
  form.append("resolution_name", "768");
  form.append("size", "720x1280");
  form.append("reference_images", new File([new Uint8Array([1, 2, 3])], "product.png", { type: "image/png" }));
  form.append("reference_images", "https://cdn.test/person.png");
  form.append("reference_audios", new File([new Uint8Array([4, 5, 6])], "voice.mp3", { type: "audio/mpeg" }));
  const request = new Request("http://gateway.local/v1/videos", { method: "POST", body: form });
  const raw = Buffer.from(await request.arrayBuffer());

  const parsed = await parseUnifiedVideoInput(raw, request.headers.get("content-type") || "");

  assert.equal(parsed.model, "autodl-minimax-h3-multi-reference");
  assert.equal(parsed.prompt, "replace the cast");
  assert.equal(parsed.duration, "15");
  assert.equal(parsed.resolution, "768");
  assert.equal(parsed.size, "720x1280");
  assert.deepEqual(parsed.referenceImages, ["data:image/png;base64,AQID", "https://cdn.test/person.png"]);
  assert.deepEqual(parsed.referenceAudios, ["data:audio/mpeg;base64,BAUG"]);
});

test("AutoDL local gateway submits a configured workflow with raw authorization", async (t) => {
  process.env.GATEWAY_ENCRYPTION_KEY = "a".repeat(64);
  let received;
  const upstream = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const bodyText = Buffer.concat(chunks).toString("utf8");
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch {
      body = bodyText;
    }
    received = {
      path: req.url,
      authorization: req.headers.authorization,
      body,
    };
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ code: "Success", data: { task_id: "autodl-task-1", status: "QUEUED" }, msg: "" }));
  });
  await listen(upstream);

  const storeDirectory = mkdtempSync(join(tmpdir(), "gouyingai-autodl-submit-"));
  const store = new LocalStore(join(storeDirectory, "store.json"));
  const channel = store.createChannel({
    name: "AutoDL ComfyUI",
    base_url: serverUrl(upstream),
    api_format: "autodl_comfyui",
    key_ciphertext: encryptSecret("test-autodl-token"),
    enabled: true,
  });
  store.createModel({
    channel_id: channel.id,
    model_name: "autodl-minimax-h3-multi-reference",
    display_name: "MiniMax H3 多图参考生视频",
    capability: "video",
    api_format: "autodl_comfyui",
    published: true,
    sort_order: 0,
    options: modelOptions,
  });
  const gateway = createLocalGatewayApp(store).listen(0, "127.0.0.1");
  await new Promise((resolve) => gateway.once("listening", resolve));
  t.after(async () => {
    await close(gateway);
    await close(upstream);
    rmSync(storeDirectory, { recursive: true, force: true });
  });

  const form = new FormData();
  form.append("model", "autodl-minimax-h3-multi-reference");
  form.append("prompt", "new cast with stable product");
  form.append("seconds", "15");
  form.append("resolution_name", "768");
  form.append("reference_images", new File([new Uint8Array([1, 2, 3])], "product.png", { type: "image/png" }));
  const response = await fetch(`${serverUrl(gateway)}/v1/videos`, {
    method: "POST",
    headers: { "x-gouyingai-capability": "video" },
    body: form,
  });
  const created = await response.json();

  assert.equal(response.status, 200);
  assert.match(created.id, /^gt-/);
  assert.equal(created.status, "queued");
  assert.deepEqual(received, {
    path: "/comfyui_workflow/minimax_h3_lightx2v_v5",
    authorization: "test-autodl-token",
    body: {
      prompt: "new cast with stable product",
      images: ["data:image/png;base64,AQID"],
      duration: 15,
      resolution: "768p竖",
      metadata: { label: "job-new cast with stable product", keep_audio: false },
    },
  });
});

test("AutoDL local gateway normalizes polling and proxies temporary video content", async (t) => {
  process.env.GATEWAY_ENCRYPTION_KEY = "a".repeat(64);
  let taskStatus = "RUNNING";
  let pollAuthorization;
  let mediaAuthorization = "not-requested";
  let upstreamBaseUrl = "";
  const videoBytes = Buffer.from([0, 0, 0, 24, 102, 116, 121, 112, 109, 112, 52, 50]);
  const upstream = createServer(async (req, res) => {
    if (req.url === "/video.mp4") {
      mediaAuthorization = req.headers.authorization;
      res.setHeader("content-type", "video/mp4");
      return void res.end(videoBytes);
    }
    res.setHeader("content-type", "application/json");
    if (req.method === "POST") {
      for await (const _chunk of req) void _chunk;
      return void res.end(JSON.stringify({ code: "Success", data: { task_id: "autodl-task-2", status: "QUEUED" } }));
    }
    pollAuthorization = req.headers.authorization;
    const results = taskStatus === "SUCCESS" ? [{ video_url: `${upstreamBaseUrl}/video.mp4` }] : [];
    res.end(JSON.stringify({ code: "Success", data: { task_id: "autodl-task-2", status: taskStatus, results } }));
  });
  await listen(upstream);
  upstreamBaseUrl = serverUrl(upstream);

  const storeDirectory = mkdtempSync(join(tmpdir(), "gouyingai-autodl-poll-"));
  const store = new LocalStore(join(storeDirectory, "store.json"));
  const channel = store.createChannel({
    name: "AutoDL ComfyUI",
    base_url: upstreamBaseUrl,
    api_format: "autodl_comfyui",
    key_ciphertext: encryptSecret("test-autodl-token"),
    enabled: true,
  });
  store.createModel({
    channel_id: channel.id,
    model_name: "autodl-minimax-h3-multi-reference",
    display_name: "MiniMax H3 多图参考生视频",
    capability: "video",
    api_format: "autodl_comfyui",
    published: true,
    sort_order: 0,
    options: modelOptions,
  });
  const gateway = createLocalGatewayApp(store).listen(0, "127.0.0.1");
  await new Promise((resolve) => gateway.once("listening", resolve));
  t.after(async () => {
    await close(gateway);
    await close(upstream);
    rmSync(storeDirectory, { recursive: true, force: true });
  });

  const form = new FormData();
  form.append("model", "autodl-minimax-h3-multi-reference");
  form.append("prompt", "stable product");
  form.append("seconds", "15");
  form.append("resolution_name", "768");
  form.append("reference_images", "https://cdn.test/product.png");
  const created = await (
    await fetch(`${serverUrl(gateway)}/v1/videos`, { method: "POST", headers: { "x-gouyingai-capability": "video" }, body: form })
  ).json();

  const running = await (await fetch(`${serverUrl(gateway)}/v1/videos/${created.id}`)).json();
  assert.deepEqual(running, { id: created.id, status: "in_progress" });
  assert.equal(pollAuthorization, "test-autodl-token");

  taskStatus = "SUCCESS";
  const completed = await (await fetch(`${serverUrl(gateway)}/v1/videos/${created.id}`)).json();
  assert.deepEqual(completed, { id: created.id, status: "completed" });
  assert.equal("url" in completed, false);

  const contentResponse = await fetch(`${serverUrl(gateway)}/v1/videos/${created.id}/content`);
  assert.equal(contentResponse.status, 200);
  assert.equal(contentResponse.headers.get("content-type"), "video/mp4");
  assert.deepEqual(Buffer.from(await contentResponse.arrayBuffer()), videoBytes);
  assert.equal(mediaAuthorization, undefined);
});

test("AutoDL authenticated gateway recovers a persisted task for polling", async (t) => {
  process.env.GATEWAY_ENCRYPTION_KEY = "a".repeat(64);
  let taskStatus = "QUEUED";
  const upstream = createServer(async (req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.method === "POST") {
      for await (const _chunk of req) void _chunk;
      return void res.end(JSON.stringify({ code: "Success", data: { task_id: "cloud-task-1", status: "QUEUED" } }));
    }
    res.end(JSON.stringify({ code: "Success", data: { task_id: "cloud-task-1", status: taskStatus, results: [] } }));
  });
  await listen(upstream);

  const channel = {
    id: "channel-1",
    name: "AutoDL ComfyUI",
    base_url: serverUrl(upstream),
    api_format: "autodl_comfyui",
    key_ciphertext: encryptSecret("cloud-autodl-token"),
    enabled: true,
  };
  const model = {
    id: "model-1",
    channel_id: channel.id,
    model_name: "autodl-minimax-h3-multi-reference",
    display_name: "MiniMax H3 多图参考生视频",
    capability: "video",
    api_format: "autodl_comfyui",
    published: true,
    sort_order: 0,
    options: modelOptions,
  };
  const persistedTasks = [];
  const admin = fakeSupabaseAdmin({ channels: [channel], models: [model], tasks: persistedTasks });
  const auth = { auth: { getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) } };
  const memoryTasks = new Map();
  const gateway = createGatewayApp({ auth, admin, memoryTasks }).listen(0, "127.0.0.1");
  await new Promise((resolve) => gateway.once("listening", resolve));
  t.after(async () => {
    await close(gateway);
    await close(upstream);
  });

  const form = new FormData();
  form.append("model", model.model_name);
  form.append("prompt", "stable product");
  form.append("seconds", "15");
  form.append("resolution_name", "768");
  form.append("reference_images", "https://cdn.test/product.png");
  const createResponse = await fetch(`${serverUrl(gateway)}/v1/videos`, {
    method: "POST",
    headers: { authorization: "Bearer user-token", "x-gouyingai-capability": "video" },
    body: form,
  });
  const created = await createResponse.json();
  assert.match(created.id, /^gt-/);
  assert.equal(persistedTasks.length, 1);

  memoryTasks.clear();
  taskStatus = "RUNNING";
  const pollResponse = await fetch(`${serverUrl(gateway)}/v1/videos/${created.id}`, {
    headers: { authorization: "Bearer user-token" },
  });
  assert.deepEqual(await pollResponse.json(), { id: created.id, status: "in_progress" });
});

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

function serverUrl(server) {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}`;
}

function fakeSupabaseAdmin({ channels, models, tasks }) {
  return {
    from(table) {
      const filters = [];
      const rows = table === "gouyingai_channels" ? channels : table === "gouyingai_models" ? models : table === "gouyingai_gateway_tasks" ? tasks : [];
      const builder = {
        select() {
          return builder;
        },
        eq(key, value) {
          filters.push([key, value]);
          return builder;
        },
        order() {
          return builder;
        },
        async maybeSingle() {
          return { data: filtered()[0] || null, error: null };
        },
        async upsert(value) {
          const index = tasks.findIndex((task) => task.task_id === value.task_id);
          if (index >= 0) tasks[index] = value;
          else tasks.push(value);
          return { data: value, error: null };
        },
        async insert() {
          return { data: null, error: null };
        },
        then(resolve) {
          return Promise.resolve({ data: filtered(), error: null }).then(resolve);
        },
      };
      function filtered() {
        return rows.filter((row) => filters.every(([key, value]) => row[key] === value));
      }
      return builder;
    },
  };
}
