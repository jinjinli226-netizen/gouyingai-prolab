import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createLocalGatewayApp } from "../src/local-server.ts";
import { LocalStore } from "../src/local-store.ts";

async function withServer(run) {
  const store = new LocalStore(join(mkdtempSync(join(tmpdir(), "viral-batch-routes-")), "gateway.json"));
  const server = createLocalGatewayApp(store).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try { await run(baseUrl); } finally { await new Promise((resolve) => server.close(resolve)); }
}

const body = {
  canvasId: "canvas-1", targetNodeId: "results-1", generationRevision: 1,
  clientRequestId: "batch-1", templateId: "template-1", candidateCount: 4,
  modelId: "model-1", channelId: "channel-1", maxInFlight: 2,
  input: { manifests: Array.from({ length: 4 }, (_, index) => ({ index, prompt: `candidate ${index + 1}` })) },
};

test("viral batch routes create, pause, resume and cancel a durable batch", async () => {
  await withServer(async (baseUrl) => {
    const create = await fetch(`${baseUrl}/v1/viral-batches`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    assert.equal(create.status, 201);
    const batch = (await create.json()).data;
    assert.equal(batch.candidateCount, 4);

    const duplicate = await fetch(`${baseUrl}/v1/viral-batches`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    assert.equal((await duplicate.json()).data.id, batch.id);
    const pause = await fetch(`${baseUrl}/v1/viral-batches/${batch.id}/pause`, { method: "POST" });
    assert.equal((await pause.json()).data.status, "paused");
    const resume = await fetch(`${baseUrl}/v1/viral-batches/${batch.id}/resume`, { method: "POST" });
    assert.equal((await resume.json()).data.status, "running");
    const cancel = await fetch(`${baseUrl}/v1/viral-batches/${batch.id}/cancel`, { method: "POST" });
    assert.equal((await cancel.json()).data.status, "cancelled");
  });
});

test("viral batch route enforces one to one thousand candidates", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/viral-batches`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, candidateCount: 1001 }) });
    assert.equal(response.status, 400);
  });
});

test("viral batch candidates are paginated without creating canvas nodes", async () => {
  await withServer(async (baseUrl) => {
    const created = await fetch(`${baseUrl}/v1/viral-batches`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const batch = (await created.json()).data;
    const response = await fetch(`${baseUrl}/v1/viral-batches/${batch.id}/candidates?offset=0&limit=20`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.deepEqual(payload.meta, { offset: 0, limit: 20, total: 0 });
    assert.deepEqual(payload.data, []);
  });
});

test("high-cost batches require an explicit matching authorization", async () => {
  await withServer(async (baseUrl) => {
    const denied = await fetch(`${baseUrl}/v1/viral-batches`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, clientRequestId: "cost-denied", costEstimateCents: 2500 }) });
    assert.equal(denied.status, 400);
    const allowed = await fetch(`${baseUrl}/v1/viral-batches`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, clientRequestId: "cost-allowed", costEstimateCents: 2500, authorizedCostCents: 2500 }) });
    assert.equal(allowed.status, 201);
  });
});
