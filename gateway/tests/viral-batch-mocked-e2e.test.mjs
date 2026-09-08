import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createLocalCanvasJobRepository } from "../src/canvas-job-repository.ts";
import { LocalStore } from "../src/local-store.ts";
import { createLocalViralBatchRepository } from "../src/viral-batch-repository.ts";
import { materializeViralBatchWindow, reconcileViralBatch } from "../src/viral-batch-coordinator.ts";

test("mocked 1000-candidate batch stays bounded, durable and idempotent without paid calls", async () => {
  const file = join(mkdtempSync(join(tmpdir(), "viral-e2e-")), "gateway.json");
  let store = new LocalStore(file);
  let batches = createLocalViralBatchRepository(store);
  let jobs = createLocalCanvasJobRepository(store);
  const input = {
    canvas_id: "canvas", target_node_id: "results", generation_revision: 1, client_request_id: "stable-1000", template_id: "template",
    candidate_count: 1000, model_id: "model", channel_id: "channel", max_in_flight: 3,
    input: { manifests: Array.from({ length: 1000 }, (_, index) => ({ index, prompt: `candidate ${index}` })), baseVideoInput: { seconds: "15" } },
  };
  const batch = await batches.create("local", input);
  await materializeViralBatchWindow(batch.id, batches, jobs);
  assert.equal((await jobs.list("local", { batchId: batch.id })).length, 3);
  assert.equal((await batches.get("local", batch.id)).next_candidate_index, 3);

  const duplicate = await batches.create("local", input);
  assert.equal(duplicate.id, batch.id);

  await batches.update(batch.id, { status: "paused" });
  await materializeViralBatchWindow(batch.id, batches, jobs);
  assert.equal((await jobs.list("local", { batchId: batch.id })).length, 3);

  store = new LocalStore(file);
  batches = createLocalViralBatchRepository(store);
  jobs = createLocalCanvasJobRepository(store);
  assert.equal((await batches.get("local", batch.id)).status, "paused");
  await batches.update(batch.id, { status: "running" });
  for (const job of await jobs.list("local", { batchId: batch.id })) await jobs.update(job.id, { status: "succeeded", finished_at: new Date().toISOString() });
  await reconcileViralBatch(batch.id, batches, jobs);
  await materializeViralBatchWindow(batch.id, batches, jobs);
  const recoveredJobs = await jobs.list("local", { batchId: batch.id });
  assert.equal(recoveredJobs.length, 6);
  assert.equal(new Set(recoveredJobs.map((job) => job.client_request_id)).size, 6);
});
