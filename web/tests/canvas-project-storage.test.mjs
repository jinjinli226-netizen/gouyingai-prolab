import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/stores/canvas/use-canvas-store.ts", import.meta.url), "utf8");

test("canvas persistence uses independent project records and a lightweight index", () => {
  assert.match(source, /CANVAS_PROJECT_KEY_PREFIX/);
  assert.match(source, /CANVAS_PROJECT_INDEX_KEY/);
  assert.match(source, /projectStorageKey\(project\.id\)/);
  assert.doesNotMatch(source, /localForageStorage\.setItem\(name, JSON\.stringify\(value\)\)/);
});

test("canvas persistence migrates legacy state and invalidates across tabs", () => {
  assert.match(source, /CANVAS_LEGACY_STORE_KEY/);
  assert.match(source, /BroadcastChannel/);
  assert.match(source, /navigator\.locks/);
  assert.match(source, /revision/);
});

test("rapid updates across different canvases are accumulated before the index flush", () => {
  assert.match(source, /pendingIndexChanges/);
  assert.match(source, /pendingIndexDeletes/);
  assert.match(source, /accumulatedChanges/);
});
