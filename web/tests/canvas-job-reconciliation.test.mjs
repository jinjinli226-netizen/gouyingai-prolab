import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const reconciliation = await import("../src/lib/canvas/canvas-job-reconciliation.ts").catch(() => ({}));

function node(metadata = {}) {
  return { id: "node-1", type: "video", title: "Video", position: { x: 0, y: 0 }, width: 320, height: 568, metadata };
}

function job(overrides = {}) {
  return {
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
    queuedAt: "2026-08-26T00:00:00.000Z",
    startedAt: null,
    finishedAt: null,
    createdAt: "2026-08-26T00:00:00.000Z",
    updatedAt: "2026-08-26T00:00:00.000Z",
    ...overrides,
  };
}

test("refresh keeps durable loading nodes recoverable and only errors legacy requests", () => {
  const durable = node({ status: "loading", generationJobId: "job-1", generationRevision: 2, generationStatus: "running" });
  const legacy = { ...node({ status: "loading" }), id: "legacy" };
  const reset = reconciliation.resetInterruptedCanvasGeneration([durable, legacy]);
  assert.equal(reset[0].metadata.status, "loading");
  assert.equal(reset[0].metadata.errorDetails, undefined);
  assert.equal(reset[1].metadata.status, "error");
  assert.match(reset[1].metadata.errorDetails, /刷新/);
});

test("queued and running jobs update only their matching node revision", () => {
  const nodes = [node({ status: "loading", generationJobId: "job-1", generationRevision: 2 })];
  const queued = reconciliation.reconcileCanvasJob("canvas-1", nodes, job({ status: "queued" }));
  assert.equal(queued[0].metadata.generationStatus, "queued");
  assert.equal(queued[0].metadata.status, "loading");
  const stale = reconciliation.reconcileCanvasJob("canvas-1", queued, job({ generationRevision: 1, status: "succeeded" }));
  assert.equal(stale, queued);
});

test("success applies an exact four-way result patch and duplicate delivery is a no-op", () => {
  const nodes = [node({ status: "loading", generationJobId: "job-1", generationRevision: 2 })];
  const succeeded = job({
    status: "succeeded",
    resultPatch: {
      canvasId: "canvas-1",
      nodeId: "node-1",
      jobId: "job-1",
      generationRevision: 2,
      nodePatch: { metadata: { content: "https://cdn.test/video.mp4", mimeType: "video/mp4", status: "success" } },
    },
  });
  const applied = reconciliation.reconcileCanvasJob("canvas-1", nodes, succeeded);
  assert.equal(applied[0].metadata.content, "https://cdn.test/video.mp4");
  assert.equal(applied[0].metadata.generationStatus, "succeeded");
  assert.equal(reconciliation.reconcileCanvasJob("canvas-1", applied, succeeded), applied);
});

test("failed jobs expose the server error without losing job identity", () => {
  const nodes = [node({ status: "loading", generationJobId: "job-1", generationRevision: 2 })];
  const failed = reconciliation.reconcileCanvasJob("canvas-1", nodes, job({ status: "failed", error: { message: "quota exhausted" } }));
  assert.equal(failed[0].metadata.status, "error");
  assert.equal(failed[0].metadata.errorDetails, "quota exhausted");
  assert.equal(failed[0].metadata.generationJobId, "job-1");
});

test("a retry created from the global task center is adopted from its parent job", () => {
  const nodes = [node({ status: "error", generationJobId: "job-old", generationRevision: 2, generationStatus: "failed" })];
  const retried = reconciliation.reconcileCanvasJob("canvas-1", nodes, job({ id: "job-new", parentJobId: "job-old", generationRevision: 3, status: "queued" }));
  assert.equal(retried[0].metadata.generationJobId, "job-new");
  assert.equal(retried[0].metadata.generationRevision, 3);
  assert.equal(retried[0].metadata.status, "loading");
});

test("the first completed batch image also fills its visible batch root", () => {
  const root = { ...node({ status: "success", isBatchRoot: true, batchChildIds: ["node-1"] }), id: "root-1", type: "image" };
  const child = { ...node({ status: "loading", batchRootId: "root-1", generationJobId: "job-1", generationRevision: 2 }), type: "image" };
  const succeeded = job({
    kind: "image",
    status: "succeeded",
    resultPatch: {
      canvasId: "canvas-1",
      nodeId: "node-1",
      jobId: "job-1",
      generationRevision: 2,
      nodePatch: { metadata: { content: "https://cdn.test/image.png", mimeType: "image/png" } },
    },
  });
  const applied = reconciliation.reconcileCanvasJob("canvas-1", [root, child], succeeded);
  assert.equal(applied[0].metadata.content, "https://cdn.test/image.png");
  assert.equal(applied[0].metadata.primaryImageId, "node-1");
  assert.equal(applied[1].metadata.generationStatus, "succeeded");
});

test("canvas video generation submits a durable job and refresh polls it", async () => {
  const source = await readFile(new URL("../src/pages/canvas/project.tsx", import.meta.url), "utf8");
  const videoStart = source.indexOf('if (mode === "video")', source.indexOf("const handleGenerateNode"));
  const videoEnd = source.indexOf('if (mode === "audio")', videoStart);
  const videoBranch = source.slice(videoStart, videoEnd);
  assert.match(source, /resetInterruptedCanvasGeneration/);
  assert.match(source, /listCanvasJobs\(\{ canvasId: projectId \}\)/);
  assert.match(videoBranch, /createCanvasJob/);
  assert.match(videoBranch, /canvasJobReference/);
  assert.doesNotMatch(videoBranch, /requestVideoGeneration/);
});
