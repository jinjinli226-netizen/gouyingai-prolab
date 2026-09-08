import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const store = await readFile(new URL("../src/stores/canvas/use-canvas-job-store.ts", import.meta.url), "utf8").catch(() => "");
const component = await readFile(new URL("../src/components/canvas/canvas-job-center.tsx", import.meta.url), "utf8").catch(() => "");
const layout = await readFile(new URL("../src/layouts/user-layout.tsx", import.meta.url), "utf8");

test("global canvas task center polls all canvases and exposes navigation, cancel and retry", () => {
  assert.match(store, /listCanvasJobs\(\)/);
  assert.match(store, /cancelCanvasJob/);
  assert.match(store, /retryCanvasJob/);
  assert.match(component, /navigate\(`\/canvas\/\$\{encodeURIComponent\(job\.canvasId\)\}`\)/);
  assert.match(component, /排队|生成中|已完成|失败/);
  assert.match(layout, /<CanvasJobCenter\s*\/>/);
});
