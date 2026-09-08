import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createViralBatchIdempotencyKey, estimateViralBatchCost } from "../src/lib/canvas/viral-video-cost.ts";

describe("viral batch cost and idempotency", () => {
  test("shows per-candidate and total cost before submission", () => {
    const result = estimateViralBatchCost({ candidateCount: 100, durationSeconds: 15, videoCentsPerSecond: 1, imageCountPerCandidate: 2, imageCents: 2.5, textCentsPerCandidate: 1, authorizationThresholdCents: 1000 });
    assert.equal(result.perCandidateCents, 21);
    assert.equal(result.totalCents, 2100);
    assert.equal(result.requiresAuthorization, true);
  });

  test("stable inputs produce the same idempotency key", () => {
    const first = createViralBatchIdempotencyKey({ templateId: "t1", recipeId: "r1", seed: 8, candidateCount: 10, modelId: "m1", draftRevision: 3 });
    const second = createViralBatchIdempotencyKey({ modelId: "m1", candidateCount: 10, seed: 8, recipeId: "r1", templateId: "t1", draftRevision: 3 });
    assert.equal(first, second);
    assert.notEqual(first, createViralBatchIdempotencyKey({ templateId: "t1", recipeId: "r1", seed: 8, candidateCount: 11, modelId: "m1", draftRevision: 3 }));
  });
});
