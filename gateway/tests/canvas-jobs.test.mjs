import assert from "node:assert/strict";
import test from "node:test";

const jobs = await import("../src/canvas-jobs.ts").catch(() => ({}));

const baseJob = {
  id: "job-1",
  user_id: "user-1",
  canvas_id: "canvas-1",
  parent_job_id: null,
  target_node_id: "node-1",
  generation_revision: 2,
  client_request_id: "request-1",
  kind: "video",
  status: "running",
  model_id: "model-1",
  channel_id: "channel-1",
  input: { prompt: "private prompt" },
  upstream_task_id: "upstream-1",
  result: null,
  result_patch: null,
  error: null,
  attempt: 1,
  max_attempts: 1,
  lease_owner: "worker-1",
  lease_expires_at: "2026-08-26T12:00:00.000Z",
  heartbeat_at: "2026-08-26T11:59:30.000Z",
  queued_at: "2026-08-26T11:00:00.000Z",
  started_at: "2026-08-26T11:01:00.000Z",
  finished_at: null,
  created_at: "2026-08-26T11:00:00.000Z",
  updated_at: "2026-08-26T11:59:30.000Z",
};

test("canvas job transitions never reopen terminal jobs", () => {
  assert.equal(jobs.canTransitionCanvasJob?.("queued", "leased"), true);
  assert.equal(jobs.canTransitionCanvasJob?.("leased", "submitting"), true);
  assert.equal(jobs.canTransitionCanvasJob?.("submitting", "running"), true);
  assert.equal(jobs.canTransitionCanvasJob?.("running", "succeeded"), true);
  assert.equal(jobs.canTransitionCanvasJob?.("succeeded", "running"), false);
  assert.equal(jobs.canTransitionCanvasJob?.("failed", "queued"), false);
  assert.equal(jobs.canTransitionCanvasJob?.("cancelled", "running"), false);
});

test("canvas result patches must match canvas, node, job, and generation revision", () => {
  const patch = { canvasId: "canvas-1", nodeId: "node-1", jobId: "job-1", generationRevision: 2, nodePatch: { metadata: { status: "success" } } };
  assert.equal(jobs.matchesCanvasJobResultPatch?.(baseJob, patch), true);
  assert.equal(jobs.matchesCanvasJobResultPatch?.(baseJob, { ...patch, canvasId: "canvas-2" }), false);
  assert.equal(jobs.matchesCanvasJobResultPatch?.(baseJob, { ...patch, nodeId: "node-2" }), false);
  assert.equal(jobs.matchesCanvasJobResultPatch?.(baseJob, { ...patch, jobId: "job-2" }), false);
  assert.equal(jobs.matchesCanvasJobResultPatch?.(baseJob, { ...patch, generationRevision: 1 }), false);
});

test("public canvas jobs exclude private inputs and worker internals", () => {
  const output = jobs.toPublicCanvasJob?.(baseJob);
  assert.deepEqual(output, {
    id: "job-1",
    canvasId: "canvas-1",
    parentJobId: null,
    targetNodeId: "node-1",
    generationRevision: 2,
    clientRequestId: "request-1",
    kind: "video",
    status: "running",
    modelId: "model-1",
    result: null,
    resultPatch: null,
    error: null,
    attempt: 1,
    queuedAt: "2026-08-26T11:00:00.000Z",
    startedAt: "2026-08-26T11:01:00.000Z",
    finishedAt: null,
    createdAt: "2026-08-26T11:00:00.000Z",
    updatedAt: "2026-08-26T11:59:30.000Z",
  });
  assert.equal("input" in output, false);
  assert.equal("leaseOwner" in output, false);
  assert.equal("upstreamTaskId" in output, false);
});
