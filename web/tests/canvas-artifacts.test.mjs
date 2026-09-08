import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/services/api/canvas-artifacts.ts", import.meta.url), "utf8").catch(() => "");

test("canvas artifact client uploads multipart media without embedding it in a job", () => {
  assert.match(source, /export async function uploadCanvasArtifact/);
  assert.match(source, /export async function resolveCanvasArtifactUrl/);
  assert.match(source, /new FormData\(\)/);
  assert.match(source, /form\.append\("canvasId"/);
  assert.match(source, /form\.append\("file"/);
  assert.doesNotMatch(source, /readAsDataURL|base64/);
});
