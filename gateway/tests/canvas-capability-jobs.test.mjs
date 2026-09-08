import assert from "node:assert/strict";
import test from "node:test";

const textModule = await import("../src/canvas-job-handlers/text-job-handler.ts").catch(() => ({}));
const imageModule = await import("../src/canvas-job-handlers/image-job-handler.ts").catch(() => ({}));
const audioModule = await import("../src/canvas-job-handlers/audio-job-handler.ts").catch(() => ({}));

function job(kind, input = {}) {
  const now = new Date().toISOString();
  return {
    id: `job-${kind}`,
    user_id: "local",
    canvas_id: "canvas-1",
    parent_job_id: null,
    target_node_id: `node-${kind}`,
    generation_revision: 1,
    client_request_id: `request-${kind}`,
    kind,
    status: "leased",
    model_id: `model-${kind}`,
    channel_id: `channel-${kind}`,
    input,
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
  };
}

function routeRuntime(kind, generate) {
  return {
    loadModel: async () => ({ id: `model-${kind}`, channel_id: `channel-${kind}`, model_name: `${kind}-model`, display_name: kind, capability: kind, api_format: "openai", published: true, sort_order: 0, options: {} }),
    loadChannel: async () => ({ id: `channel-${kind}`, name: kind, base_url: "https://upstream.test", api_format: "openai", key_ciphertext: "secret", enabled: true }),
    generate,
    isGenerationCurrent: async () => true,
  };
}

async function invoke(handler, task) {
  let current = task;
  return handler({
    job: task,
    signal: new AbortController().signal,
    update: async (patch) => (current = { ...current, ...patch }),
  });
}

test("text job stores a node result patch", async () => {
  const handler = textModule.createTextJobHandler(routeRuntime("text", async () => ({ text: "durable answer" })));
  const result = await invoke(handler, job("text", { prompt: "answer me" }));
  assert.equal(result.result.text, "durable answer");
  assert.deepEqual(result.result_patch.nodePatch, { metadata: { content: "durable answer", status: "success", errorDetails: undefined } });
});

test("image job stores only durable artifact metadata", async () => {
  const handler = imageModule.createImageJobHandler(routeRuntime("image", async () => ({ url: "https://gateway.test/image", storageKey: "canvas-artifact:path/image", mimeType: "image/png", width: 1024, height: 1024 })));
  const result = await invoke(handler, job("image", { prompt: "image" }));
  assert.equal(result.result.storageKey, "canvas-artifact:path/image");
  assert.doesNotMatch(JSON.stringify(result), /base64/);
  assert.equal(result.result_patch.nodePatch.metadata.content, "https://gateway.test/image");
});

test("audio job stores a durable playable artifact", async () => {
  const handler = audioModule.createAudioJobHandler(routeRuntime("audio", async () => ({ url: "https://gateway.test/audio", storageKey: "canvas-artifact:path/audio", mimeType: "audio/mpeg", bytes: 42 })));
  const result = await invoke(handler, job("audio", { prompt: "speak" }));
  assert.equal(result.result.bytes, 42);
  assert.equal(result.result_patch.nodePatch.metadata.storageKey, "canvas-artifact:path/audio");
});

test("capability handlers fail closed on mismatched model routes", async () => {
  const runtime = routeRuntime("image", async () => ({ url: "never" }));
  runtime.loadModel = async () => ({ id: "model-image", channel_id: "wrong", capability: "image", published: true });
  const handler = imageModule.createImageJobHandler(runtime);
  await assert.rejects(() => invoke(handler, job("image")), /路由绑定已失效/);
});
