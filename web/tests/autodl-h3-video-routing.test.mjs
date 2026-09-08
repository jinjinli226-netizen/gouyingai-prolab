import assert from "node:assert/strict";
import test from "node:test";

const { resolveAutoDlH3CanvasVideoConfig } = await import("../src/lib/canvas/autodl-h3-video-routing.ts");

const models = [
  routeModel("auto", "auto", 15, 0, 0, 0, 0),
  routeModel("text", "text", 15, 0, 0, 0, 0),
  routeModel("images-10", "multi-reference", 10, 1, 9, 0, 0),
  routeModel("images-15", "multi-reference", 15, 1, 9, 0, 0),
  routeModel("first-last", "first-last", 15, 2, 2, 0, 0),
  routeModel("audio-10", "multi-reference-audio", 10, 1, 9, 1, 3),
  routeModel("audio-15", "multi-reference-audio", 15, 1, 9, 1, 3),
  routeModel("lip-sync", "lip-sync", 15, 1, 1, 1, 1),
];

const config = { videoModel: "auto", model: "auto", videoModels: models.map((item) => item.model) };

test("H3 auto routing selects standard and 15-second image workflows by duration", () => {
  assert.equal(resolve({ imageCount: 2, duration: "10" }).model, "images-10");
  assert.equal(resolve({ imageCount: 2, duration: "11" }).model, "images-15");
});

test("H3 auto routing uses explicit modes for ambiguous first-last and lip-sync inputs", () => {
  assert.equal(resolve({ imageCount: 2, mode: "first-last" }).model, "first-last");
  assert.equal(resolve({ imageCount: 1, audioCount: 1, mode: "lip-sync" }).model, "lip-sync");
  assert.equal(resolve({ imageCount: 1, audioCount: 1, mode: "auto" }).model, "audio-10");
});

test("H3 routing rejects unsupported media and invalid explicit modes before submission", () => {
  assert.throws(() => resolve({ videoCount: 1 }), /不支持参考视频/);
  assert.throws(() => resolve({ imageCount: 1, mode: "first-last" }), /恰好连接两张图片/);
  assert.throws(() => resolve({ imageCount: 2, audioCount: 1, mode: "lip-sync" }), /一张人物图和一段音频/);
});

function resolve(patch = {}) {
  return resolveAutoDlH3CanvasVideoConfig(config, { imageCount: 0, audioCount: 0, videoCount: 0, duration: "5", mode: "auto", ...patch }, models);
}

function routeModel(modelName, kind, maxDuration, minImages, maxImages, minAudios, maxAudios) {
  return {
    model: modelName,
    displayName: modelName,
    options: {
      canvasVideoRoute: { family: "minimax-h3-autodl", kind, minDuration: 1, maxDuration },
      autodl: { minReferenceImages: minImages, maxReferenceImages: maxImages, minReferenceAudios: minAudios, maxReferenceAudios: maxAudios },
    },
  };
}
