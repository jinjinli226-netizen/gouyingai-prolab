import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createLocalGatewayApp } from "../src/local-server.ts";
import { LocalStore } from "../src/local-store.ts";

async function withServer(run) {
  const directory = mkdtempSync(join(tmpdir(), "gouyingai-canvas-job-routes-"));
  const store = new LocalStore(join(directory, "gateway.json"));
  const server = createLocalGatewayApp(store).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await run({ baseUrl, store });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function jobBody(clientRequestId = "request-1") {
  return {
    canvasId: "canvas-1",
    targetNodeId: "node-1",
    generationRevision: 2,
    clientRequestId,
    kind: "video",
    modelId: "model-1",
    channelId: "channel-1",
    input: { prompt: "make a durable video" },
  };
}

test("canvas job routes create, deduplicate, list, get, cancel and retry jobs", async () => {
  await withServer(async ({ baseUrl }) => {
    const create = await fetch(`${baseUrl}/v1/canvas-jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(jobBody()),
    });
    assert.equal(create.status, 201);
    const created = (await create.json()).data;
    assert.equal(created.status, "queued");
    assert.equal(created.canvasId, "canvas-1");
    assert.equal(created.input, undefined);

    const duplicate = await fetch(`${baseUrl}/v1/canvas-jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(jobBody()),
    });
    assert.equal((await duplicate.json()).data.id, created.id);

    const list = await fetch(`${baseUrl}/v1/canvas-jobs?canvasId=canvas-1`);
    assert.deepEqual((await list.json()).data.map((job) => job.id), [created.id]);

    const get = await fetch(`${baseUrl}/v1/canvas-jobs/${created.id}`);
    assert.equal((await get.json()).data.id, created.id);

    const cancel = await fetch(`${baseUrl}/v1/canvas-jobs/${created.id}/cancel`, { method: "POST" });
    assert.equal((await cancel.json()).data.status, "cancelled");

    const retry = await fetch(`${baseUrl}/v1/canvas-jobs/${created.id}/retry`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientRequestId: "request-retry", generationRevision: 3 }),
    });
    const retried = (await retry.json()).data;
    assert.notEqual(retried.id, created.id);
    assert.equal(retried.parentJobId, created.id);
    assert.equal(retried.generationRevision, 3);
  });
});

test("canvas job routes validate input", async () => {
  await withServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/v1/canvas-jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...jobBody(), generationRevision: 0 }),
    });
    assert.equal(response.status, 400);
  });
});

test("video task polling never exposes another owner's task", async () => {
  await withServer(async ({ baseUrl, store }) => {
    store.saveTask({
      task_id: "gt-private",
      user_id: "another-user",
      channel_id: "channel-1",
      model_id: "model-1",
      upstream_task_id: "upstream-1",
      capability: "video",
    });
    const response = await fetch(`${baseUrl}/v1/videos/gt-private`);
    assert.equal(response.status, 404);
  });
});
