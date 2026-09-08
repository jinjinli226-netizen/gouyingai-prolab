import assert from "node:assert/strict";
import test from "node:test";

const runnerModule = await import("../src/canvas-job-runner.ts").catch(() => ({}));

function makeJob(id, canvasId, kind = "video", channelId = "channel-1", upstreamTaskId = null) {
  const now = new Date().toISOString();
  return {
    id,
    user_id: "local",
    canvas_id: canvasId,
    parent_job_id: null,
    target_node_id: `node-${id}`,
    generation_revision: 1,
    client_request_id: `request-${id}`,
    kind,
    status: "queued",
    model_id: "model-1",
    channel_id: channelId,
    input: {},
    upstream_task_id: upstreamTaskId,
    result: null,
    result_patch: null,
    error: null,
    attempt: 0,
    max_attempts: 1,
    lease_owner: null,
    lease_expires_at: null,
    heartbeat_at: null,
    queued_at: now,
    started_at: null,
    finished_at: null,
    created_at: now,
    updated_at: now,
  };
}

function fakeRepository(jobs) {
  const values = new Map(jobs.map((job) => [job.id, job]));
  return {
    values,
    async create() { throw new Error("not used"); },
    async get(userId, id) { return values.get(id)?.user_id === userId ? values.get(id) : null; },
    async list() { return [...values.values()]; },
    async update(id, patch) {
      const job = values.get(id);
      if (!job) return null;
      Object.assign(job, patch, { updated_at: new Date().toISOString() });
      return job;
    },
    async claim(workerId, limit, leaseSeconds) {
      return [...values.values()].filter((job) => job.status === "queued").slice(0, limit).map((job) => {
        Object.assign(job, {
          status: "leased",
          lease_owner: workerId,
          lease_expires_at: new Date(Date.now() + leaseSeconds * 1000).toISOString(),
          attempt: job.attempt + 1,
        });
        return job;
      });
    },
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test("runner respects global, capability and channel concurrency", async () => {
  const repository = fakeRepository([
    makeJob("a", "canvas-a", "video", "slow-channel"),
    makeJob("b", "canvas-b", "video", "slow-channel"),
    makeJob("c", "canvas-c", "image", "image-channel"),
  ]);
  const gates = new Map();
  const started = [];
  const runner = new runnerModule.CanvasJobRunner({
    repository,
    handler: async ({ job }) => {
      started.push(job.id);
      const gate = deferred();
      gates.set(job.id, gate);
      await gate.promise;
      return { result: { ok: true } };
    },
    settings: {
      globalConcurrency: 2,
      capabilityConcurrency: { video: 1, image: 1 },
      channelConcurrency: { "slow-channel": 1 },
      leaseSeconds: 60,
      heartbeatIntervalMs: 10,
      pollIntervalMs: 1000,
      claimBatch: 10,
    },
  });

  await runner.runOnce();
  assert.deepEqual(started.sort(), ["a", "c"]);
  assert.equal(runner.activeCount, 2);
  gates.get("a").resolve();
  gates.get("c").resolve();
  await runner.waitForIdle();
  await runner.runOnce();
  assert.deepEqual(started.sort(), ["a", "b", "c"]);
  gates.get("b").resolve();
  await runner.waitForIdle();
});

test("runner selects fairly across canvases and heartbeats active leases", async () => {
  const repository = fakeRepository([
    makeJob("a1", "canvas-a"),
    makeJob("a2", "canvas-a"),
    makeJob("b1", "canvas-b"),
  ]);
  const gate = deferred();
  const started = [];
  const runner = new runnerModule.CanvasJobRunner({
    repository,
    handler: async ({ job }) => {
      started.push(job.id);
      await gate.promise;
      return { result: {} };
    },
    settings: {
      globalConcurrency: 2,
      capabilityConcurrency: {},
      channelConcurrency: {},
      leaseSeconds: 60,
      heartbeatIntervalMs: 5,
      pollIntervalMs: 1000,
      claimBatch: 10,
    },
  });
  await runner.runOnce();
  assert.deepEqual(started, ["a1", "b1"]);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(repository.values.get("a1").heartbeat_at);
  gate.resolve();
  await runner.waitForIdle();
});

test("runner passes persisted upstream task to recovery handler and stop never cancels it", async () => {
  const repository = fakeRepository([makeJob("resume", "canvas-a", "video", "channel-1", "upstream-123")]);
  const gate = deferred();
  let observedUpstream;
  let observedAbort;
  const runner = new runnerModule.CanvasJobRunner({
    repository,
    handler: async ({ job, signal }) => {
      observedUpstream = job.upstream_task_id;
      observedAbort = signal.aborted;
      await gate.promise;
      observedAbort = signal.aborted;
      return { result: {} };
    },
    settings: {
      globalConcurrency: 1,
      capabilityConcurrency: {},
      channelConcurrency: {},
      leaseSeconds: 60,
      heartbeatIntervalMs: 10,
      pollIntervalMs: 1000,
      claimBatch: 1,
    },
  });
  await runner.runOnce();
  runner.stop();
  assert.equal(observedUpstream, "upstream-123");
  assert.equal(observedAbort, false);
  gate.resolve();
  await runner.waitForIdle();
  assert.equal(observedAbort, false);
});

test("runner observes a persisted cancellation request and finishes the job as cancelled", async () => {
  const repository = fakeRepository([makeJob("cancel-me", "canvas-a")]);
  const runner = new runnerModule.CanvasJobRunner({
    repository,
    handler: async ({ signal }) => {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 1_000);
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new Error("aborted"));
        }, { once: true });
      });
      return { result: {} };
    },
    settings: {
      globalConcurrency: 1,
      capabilityConcurrency: {},
      channelConcurrency: {},
      leaseSeconds: 60,
      heartbeatIntervalMs: 5,
      pollIntervalMs: 1000,
      claimBatch: 1,
    },
  });

  await runner.runOnce();
  await repository.update("cancel-me", { status: "cancel_requested" });
  await runner.waitForIdle();
  assert.equal(repository.values.get("cancel-me").status, "cancelled");
  assert.ok(repository.values.get("cancel-me").finished_at);
});
