import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const videoModule = await import("../src/canvas-job-handlers/video-job-handler.ts").catch(() => ({}));
const { encryptSecret } = await import("../src/encryption.ts");
const { LocalStore } = await import("../src/local-store.ts");

function job(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: "job-1",
    user_id: "local",
    canvas_id: "canvas-1",
    parent_job_id: null,
    target_node_id: "node-1",
    generation_revision: 2,
    client_request_id: "request-1",
    kind: "video",
    status: "leased",
    model_id: "model-id",
    channel_id: "channel-id",
    input: { prompt: "durable video", seconds: "6", size: "720x1280", resolution: "720p", referenceImages: [], referenceAudios: [] },
    upstream_task_id: null,
    result: null,
    result_patch: null,
    error: null,
    attempt: 1,
    max_attempts: 1,
    lease_owner: "worker",
    lease_expires_at: now,
    heartbeat_at: now,
    queued_at: now,
    started_at: now,
    finished_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function runtime(overrides = {}) {
  return {
    loadModel: async () => ({ id: "model-id", channel_id: "channel-id", model_name: "video-model", display_name: "Video", capability: "video", api_format: "openai", published: true, sort_order: 0, options: {} }),
    loadChannel: async () => ({ id: "channel-id", name: "Channel", base_url: "https://upstream.test", api_format: "openai", key_ciphertext: "secret", enabled: true }),
    submit: async () => ({ upstreamTaskId: "upstream-1", status: "pending" }),
    poll: async () => ({ status: "completed", result: { url: "https://cdn.test/video.mp4", mimeType: "video/mp4" } }),
    sleep: async () => {},
    isGenerationCurrent: async () => true,
    ...overrides,
  };
}

async function runHandler(handler, initialJob) {
  let current = initialJob;
  const updates = [];
  const result = await handler({
    job: initialJob,
    signal: new AbortController().signal,
    update: async (patch) => {
      updates.push(patch);
      current = { ...current, ...patch };
      return current;
    },
  });
  return { result, updates, current };
}

test("video handler binds the selected route and persists upstream id before polling", async () => {
  const events = [];
  const handler = videoModule.createVideoJobHandler(runtime({
    submit: async ({ model, channel }) => {
      events.push(`submit:${model.id}:${channel.id}`);
      return { upstreamTaskId: "upstream-1", status: "pending" };
    },
    poll: async ({ upstreamTaskId }) => {
      events.push(`poll:${upstreamTaskId}`);
      return { status: "completed", result: { url: "https://cdn.test/video.mp4", mimeType: "video/mp4" } };
    },
  }));

  const { result, updates } = await runHandler(handler, job());
  assert.deepEqual(events, ["submit:model-id:channel-id", "poll:upstream-1"]);
  assert.equal(updates[0].upstream_task_id, "upstream-1");
  assert.equal(updates[0].status, "running");
  assert.equal(result.result.url, "https://cdn.test/video.mp4");
  assert.deepEqual(result.result_patch, {
    canvasId: "canvas-1",
    nodeId: "node-1",
    jobId: "job-1",
    generationRevision: 2,
    nodePatch: { metadata: { content: "https://cdn.test/video.mp4", mimeType: "video/mp4", status: "success", errorDetails: undefined } },
  });
});

test("video handler resumes an existing upstream task without resubmitting", async () => {
  let submits = 0;
  let polls = 0;
  const handler = videoModule.createVideoJobHandler(runtime({
    submit: async () => { submits += 1; return { upstreamTaskId: "new", status: "pending" }; },
    poll: async ({ upstreamTaskId }) => {
      polls += 1;
      assert.equal(upstreamTaskId, "upstream-existing");
      return { status: "completed", result: { url: "https://cdn.test/resumed.mp4" } };
    },
  }));
  await runHandler(handler, job({ upstream_task_id: "upstream-existing", status: "leased" }));
  assert.equal(submits, 0);
  assert.equal(polls, 1);
});

test("video handler keeps stale revision results but marks them unmounted", async () => {
  const handler = videoModule.createVideoJobHandler(runtime({ isGenerationCurrent: async () => false }));
  const { result } = await runHandler(handler, job());
  assert.equal(result.result.mounted, false);
  assert.equal(result.result_patch, null);
});

test("video handler never retries an unknown submit outcome", async () => {
  let submits = 0;
  const handler = videoModule.createVideoJobHandler(runtime({
    submit: async () => {
      submits += 1;
      throw new Error("上游提交结果未知");
    },
  }));
  await assert.rejects(() => runHandler(handler, job()), /结果未知/);
  assert.equal(submits, 1);
});

test("video handler rejects a route that no longer matches its model binding", async () => {
  const handler = videoModule.createVideoJobHandler(runtime({
    loadModel: async () => ({ id: "model-id", channel_id: "another-channel", model_name: "video-model", capability: "video", published: true }),
  }));
  await assert.rejects(() => runHandler(handler, job()), /路由绑定已失效/);
});

test("video runtime rejects arbitrary reference URLs before calling an upstream", async () => {
  const directory = mkdtempSync(join(tmpdir(), "gouyingai-video-private-input-"));
  const store = new LocalStore(join(directory, "gateway.json"));
  const handler = videoModule.createVideoJobHandler(videoModule.createLocalVideoJobRuntime(store, {
    loadModel: async () => ({ id: "model-1", channel_id: "channel-1", model_name: "video-model", capability: "video", published: true, options: {} }),
    loadChannel: async () => ({ id: "channel-1", name: "Video", base_url: "https://upstream.invalid", api_format: "openai", key_ciphertext: "", enabled: true }),
  }));
  await assert.rejects(
    () => runHandler(handler, job({ input: { prompt: "unsafe", referenceImages: ["http://127.0.0.1/private"] } })),
    /私有参考素材/,
  );
});

test("durable AutoDL video jobs normalize numeric resolutions before workflow mapping", async (t) => {
  process.env.GATEWAY_ENCRYPTION_KEY = "a".repeat(64);
  let receivedBody;
  const upstream = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    receivedBody = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ code: "Success", data: { task_id: "autodl-task", status: "SUCCESS", results: [{ url: "https://cdn.test/video.mp4" }] } }));
  });
  await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const address = upstream.address();
  const directory = mkdtempSync(join(tmpdir(), "gouyingai-autodl-resolution-"));
  t.after(async () => {
    await new Promise((resolve) => upstream.close(resolve));
    rmSync(directory, { recursive: true, force: true });
  });

  const store = new LocalStore(join(directory, "gateway.json"));
  const channel = store.createChannel({
    name: "AutoDL",
    base_url: `http://127.0.0.1:${address.port}`,
    api_format: "autodl_comfyui",
    key_ciphertext: encryptSecret("autodl-token"),
    enabled: true,
  });
  const model = store.createModel({
    channel_id: channel.id,
    model_name: "autodl-video",
    display_name: "AutoDL Video",
    capability: "video",
    api_format: "autodl_comfyui",
    published: true,
    sort_order: 0,
    options: {
      autodl: {
        workflowId: "workflow-1",
        requestTemplate: { prompt: "{{prompt}}", duration: "{{duration}}", resolution: "{{resolution}}" },
        durationMap: { "15": 15 },
        resolutionMap: { "768p|vertical": "768p竖" },
        minReferenceImages: 0,
        maxReferenceImages: 0,
      },
    },
  });
  const handler = videoModule.createVideoJobHandler(videoModule.createLocalVideoJobRuntime(store, {
    saveResult: async ({ result }) => result,
  }));

  const { result } = await runHandler(handler, job({
    model_id: model.id,
    channel_id: channel.id,
    input: { prompt: "durable video", seconds: "15", size: "720x1280", resolution: "768", referenceImages: [], referenceAudios: [] },
  }));

  assert.equal(result.result.url, "https://cdn.test/video.mp4");
  assert.deepEqual(receivedBody, { prompt: "durable video", duration: 15, resolution: "768p竖" });
});

test("local video runtime submits and resumes a real configured upstream route", async (t) => {
  process.env.GATEWAY_ENCRYPTION_KEY = "a".repeat(64);
  let submits = 0;
  let polls = 0;
  let submittedBody = "";
  const upstream = createServer(async (req, res) => {
    if (req.url === "/result.mp4") {
      res.setHeader("content-type", "video/mp4");
      return void res.end(Buffer.from([0, 0, 0, 24, 102, 116, 121, 112]));
    }
    res.setHeader("content-type", "application/json");
    if (req.method === "POST") {
      submits += 1;
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      submittedBody = Buffer.concat(chunks).toString("latin1");
      return void res.end(JSON.stringify({ id: "upstream-real", status: "queued" }));
    }
    polls += 1;
    res.end(JSON.stringify({ id: "upstream-real", status: "completed", url: `http://127.0.0.1:${address.port}/result.mp4` }));
  });
  await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const address = upstream.address();
  const directory = mkdtempSync(join(tmpdir(), "gouyingai-video-runtime-"));
  t.after(async () => {
    await new Promise((resolve) => upstream.close(resolve));
    rmSync(directory, { recursive: true, force: true });
  });

  const store = new LocalStore(join(directory, "gateway.json"));
  const channel = store.createChannel({
    name: "Video",
    base_url: `http://127.0.0.1:${address.port}`,
    api_format: "openai",
    key_ciphertext: encryptSecret("upstream-key"),
    enabled: true,
  });
  const model = store.createModel({
    channel_id: channel.id,
    model_name: "video-model",
    display_name: "Video",
    capability: "video",
    api_format: "openai",
    published: true,
    sort_order: 0,
    options: {},
  });
  const artifact = store.saveCanvasArtifact("local", "canvas-1", {
    name: "reference.png",
    mimeType: "image/png",
    bytes: Buffer.from([1, 2, 3, 4]),
    checksum: "checksum",
  });
  const handler = videoModule.createVideoJobHandler(videoModule.createLocalVideoJobRuntime(store, { sleep: async () => {} }));
  const { result } = await runHandler(handler, job({
    model_id: model.id,
    channel_id: channel.id,
    input: { prompt: "durable video", seconds: "6", size: "720x1280", resolution: "720p", referenceImages: [artifact.uri], referenceAudios: [] },
  }));

  assert.equal(submits, 1);
  assert.equal(polls, 1);
  assert.match(result.result.url, /\/v1\/canvas-artifacts\/content/);
  assert.match(result.result.storageKey, /^canvas-artifact:local\//);
  assert.equal(store.readCanvasArtifact("local", "canvas-1", result.result.storageKey).bytes.length, 8);
  assert.doesNotMatch(submittedBody, /canvas-artifact:/);
  assert.match(submittedBody, /filename="reference-0"/);
});
