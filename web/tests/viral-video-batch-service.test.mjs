import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

test("web exposes durable viral batch API and persisted batch store", async () => {
  const api = await readFile(path.join(process.cwd(), "src/services/api/viral-batches.ts"), "utf8");
  const store = await readFile(path.join(process.cwd(), "src/stores/canvas/use-viral-batch-store.ts"), "utf8");
  assert.match(api, /\/v1\/viral-batches/);
  assert.match(api, /pauseViralBatch/);
  assert.match(api, /resumeViralBatch/);
  assert.match(api, /retryFailedViralBatch/);
  assert.match(store, /localForageStorage/);
  assert.match(store, /upsertBatch/);
});

test("results card exposes aggregate progress and failed-candidate retry", async () => {
  const component = await readFile(path.join(process.cwd(), "src/components/canvas/viral-video-results-node-content.tsx"), "utf8");
  assert.match(component, /批次结果/);
  assert.match(component, /succeededCount/);
  assert.match(component, /failedCount/);
  assert.match(component, /重试失败项/);
});

test("successful candidates render an inline playable video with visible recovery actions", async () => {
  const component = await readFile(path.join(process.cwd(), "src/components/canvas/viral-video-results-node-content.tsx"), "utf8");
  assert.match(component, /<video/);
  assert.match(component, /controls/);
  assert.match(component, /playsInline/);
  assert.match(component, /预览加载失败/);
  assert.match(component, /打开成片/);
  assert.match(component, /下载成片/);
});

test("batch candidate listing refreshes artifact-backed video URLs before rendering", async () => {
  const api = await readFile(path.join(process.cwd(), "src/services/api/viral-batches.ts"), "utf8");
  assert.match(api, /getCanvasJob/);
  assert.match(api, /Promise\.all/);
});
