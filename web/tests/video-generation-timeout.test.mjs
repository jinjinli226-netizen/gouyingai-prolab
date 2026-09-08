import assert from "node:assert/strict";
import test from "node:test";

const videoPolling = await import("../src/services/api/video-polling.ts").catch(() => ({}));

test("video generation polling allows fifty minutes for every provider", () => {
    assert.equal(videoPolling.VIDEO_GENERATION_TIMEOUT_MS, 50 * 60 * 1000);
    assert.equal(videoPolling.videoGenerationPollAttempts?.(2500), 1200);
    assert.equal(videoPolling.videoGenerationPollAttempts?.(5000), 600);
    assert.equal(videoPolling.videoGenerationPollAttempts?.(8000), 375);
});
