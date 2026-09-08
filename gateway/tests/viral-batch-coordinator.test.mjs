import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createLocalCanvasJobRepository } from "../src/canvas-job-repository.ts";
import { LocalStore } from "../src/local-store.ts";
import { createLocalViralBatchRepository } from "../src/viral-batch-repository.ts";
import { materializeViralBatchWindow, reconcileViralBatch } from "../src/viral-batch-coordinator.ts";

test("coordinator materializes only a bounded candidate window and refills it", async () => {
  const store = new LocalStore(join(mkdtempSync(join(tmpdir(), "viral-batch-coordinator-")), "gateway.json"));
  const batches = createLocalViralBatchRepository(store);
  const jobs = createLocalCanvasJobRepository(store);
  const batch = await batches.create("local", {
    canvas_id: "canvas-1", target_node_id: "results", generation_revision: 1, client_request_id: "batch-1",
    template_id: "template-1", candidate_count: 5, model_id: "model-1", channel_id: "channel-1", max_in_flight: 2,
    input: { manifests: Array.from({ length: 5 }, (_, index) => ({ index, prompt: `candidate ${index}` })) },
  });

  await materializeViralBatchWindow(batch.id, batches, jobs);
  let children = await jobs.list("local", { batchId: batch.id });
  assert.equal(children.length, 2);
  assert.deepEqual(children.map((job) => job.candidate_index).sort(), [0, 1]);

  await jobs.update(children[0].id, { status: "succeeded", finished_at: new Date().toISOString() });
  await reconcileViralBatch(batch.id, batches, jobs);
  await materializeViralBatchWindow(batch.id, batches, jobs);
  children = await jobs.list("local", { batchId: batch.id });
  assert.equal(children.length, 3);
  assert.equal(children.some((job) => job.candidate_index === 2), true);
});

test("paused batches do not materialize more jobs", async () => {
  const store = new LocalStore(join(mkdtempSync(join(tmpdir(), "viral-batch-pause-")), "gateway.json"));
  const batches = createLocalViralBatchRepository(store);
  const jobs = createLocalCanvasJobRepository(store);
  const batch = await batches.create("local", {
    canvas_id: "canvas-1", target_node_id: "results", generation_revision: 1, client_request_id: "batch-pause",
    template_id: "template-1", candidate_count: 2, model_id: null, channel_id: null, max_in_flight: 1,
    input: { manifests: [{ index: 0, prompt: "one" }, { index: 1, prompt: "two" }] },
  });
  await batches.update(batch.id, { status: "paused" });
  await materializeViralBatchWindow(batch.id, batches, jobs);
  assert.equal((await jobs.list("local", { batchId: batch.id })).length, 0);
});
