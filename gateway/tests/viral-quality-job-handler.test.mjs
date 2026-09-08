import assert from "node:assert/strict";
import test from "node:test";

import { createViralQualityJobHandler } from "../src/canvas-job-handlers/viral-quality-job-handler.ts";

const job = {
  id: "quality-1", user_id: "user", canvas_id: "canvas", parent_job_id: "video-1", batch_id: "batch-1", candidate_index: 0,
  target_node_id: "results:0", generation_revision: 1, client_request_id: "quality-1", kind: "viral-quality", status: "running",
  model_id: null, channel_id: null, input: { candidateId: "candidate-1", metrics: { eventCoverage: 100, timelineFidelity: 100, identityConsistency: 100, productFidelity: 100, audioFidelity: 100, visualFidelity: 100 }, missingP0EventIds: [] },
  upstream_task_id: null, result: null, result_patch: null, error: null, attempt: 1, max_attempts: 1, lease_owner: null, lease_expires_at: null, heartbeat_at: null,
  queued_at: "", started_at: "", finished_at: null, created_at: "", updated_at: "",
};

test("quality handler applies the fixed rubric and P0 cap", async () => {
  const handler = createViralQualityJobHandler();
  const passed = await handler({ job, signal: new AbortController().signal, update: async () => job });
  assert.equal(passed.result.quality.totalScore, 100);
  const capped = await handler({ job: { ...job, input: { ...job.input, missingP0EventIds: ["explosion"] } }, signal: new AbortController().signal, update: async () => job });
  assert.equal(capped.result.quality.totalScore, 79);
  assert.equal(capped.result.quality.decision, "retry");
});
