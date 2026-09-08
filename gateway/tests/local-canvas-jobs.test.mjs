import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const localStoreModule = await import("../src/local-store.ts").catch(() => ({}));

function jobInput(clientRequestId, canvasId = "canvas-1") {
  return {
    canvas_id: canvasId,
    target_node_id: `node-${clientRequestId}`,
    generation_revision: 1,
    client_request_id: clientRequestId,
    kind: "video",
    model_id: "model-1",
    channel_id: "channel-1",
    input: { prompt: clientRequestId },
  };
}

test("local canvas jobs survive restart and deduplicate client requests", () => {
  const directory = mkdtempSync(join(tmpdir(), "gouyingai-canvas-jobs-"));
  const file = join(directory, "gateway.json");
  const store = new localStoreModule.LocalStore(file);
  const created = store.createCanvasJob("user-1", jobInput("request-1"));
  const duplicate = store.createCanvasJob("user-1", jobInput("request-1", "canvas-other"));

  assert.equal(duplicate.id, created.id);
  assert.equal(new localStoreModule.LocalStore(file).getCanvasJob("user-1", created.id)?.canvas_id, "canvas-1");
  assert.equal(new localStoreModule.LocalStore(file).getCanvasJob("user-2", created.id), undefined);
  assert.doesNotThrow(() => JSON.parse(readFileSync(file, "utf8")));
});

test("local canvas jobs list by owner and canvas", () => {
  const directory = mkdtempSync(join(tmpdir(), "gouyingai-canvas-list-"));
  const store = new localStoreModule.LocalStore(join(directory, "gateway.json"));
  store.createCanvasJob("user-1", jobInput("request-a", "canvas-a"));
  store.createCanvasJob("user-1", jobInput("request-b", "canvas-b"));
  store.createCanvasJob("user-2", jobInput("request-c", "canvas-a"));

  assert.equal(store.listCanvasJobs("user-1").length, 2);
  assert.deepEqual(store.listCanvasJobs("user-1", { canvasId: "canvas-a" }).map((job) => job.client_request_id), ["request-a"]);
  assert.deepEqual(store.listCanvasJobs("user-2").map((job) => job.client_request_id), ["request-c"]);
});

test("local canvas job claims respect limits and recover expired work in every active state", () => {
  const directory = mkdtempSync(join(tmpdir(), "gouyingai-canvas-claim-"));
  const store = new localStoreModule.LocalStore(join(directory, "gateway.json"));
  const first = store.createCanvasJob("user-1", jobInput("request-1", "canvas-a"));
  store.createCanvasJob("user-1", jobInput("request-2", "canvas-b"));
  store.createCanvasJob("user-1", jobInput("request-3", "canvas-c"));

  const claimed = store.claimCanvasJobs("worker-1", 2, 60, new Date("2026-08-26T12:00:00.000Z"));
  assert.equal(claimed.length, 2);
  assert.ok(claimed.every((job) => job.status === "leased" && job.lease_owner === "worker-1"));
  assert.equal(store.claimCanvasJobs("worker-2", 2, 60, new Date("2026-08-26T12:00:01.000Z")).length, 1);

  store.updateCanvasJob(first.id, { status: "leased", lease_expires_at: "2026-08-26T11:59:59.000Z" });
  const reclaimed = store.claimCanvasJobs("worker-3", 1, 60, new Date("2026-08-26T12:01:00.000Z"));
  assert.equal(reclaimed[0].id, first.id);
  assert.equal(reclaimed[0].lease_owner, "worker-3");

  for (const status of ["submitting", "running"]) {
    store.updateCanvasJob(first.id, { status, lease_expires_at: "2026-08-26T11:59:59.000Z" });
    const recovered = store.claimCanvasJobs(`worker-${status}`, 1, 60, new Date("2026-08-26T12:02:00.000Z"));
    assert.equal(recovered[0].id, first.id);
    assert.equal(recovered[0].lease_owner, `worker-${status}`);
  }
});
