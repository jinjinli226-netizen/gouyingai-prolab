import assert from "node:assert/strict";
import test from "node:test";

import { openAIVideoReferenceImageField, openAIVideoReferenceImageLimit } from "../src/services/api/video-reference.ts";

test("MiniMax H3 uploads product images with the reference_images field", () => {
    assert.equal(openAIVideoReferenceImageField("minimax-h3-pro-2k"), "reference_images");
});

test("other OpenAI video models retain the standard input_reference array field", () => {
    assert.equal(openAIVideoReferenceImageField("sora-2"), "input_reference[]");
});

test("AutoDL MiniMax H3 accepts all nine indexed reference images", () => {
    assert.equal(openAIVideoReferenceImageLimit("minimax-h3-autodl-multi-reference"), 9);
    assert.equal(openAIVideoReferenceImageLimit("minimax-h3-pro-2k"), 7);
});
