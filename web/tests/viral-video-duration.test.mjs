import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { planViralDurationExecution, compressViralTemplateTimeline } from "../src/lib/canvas/viral-video-duration.ts";

const template = {
    sourceDurationSeconds: 24,
    targetDurationSeconds: 24,
    events: [
        { id: "hook", priority: "P0", targetStartSeconds: 0, targetEndSeconds: 4 },
        { id: "middle", priority: "P1", targetStartSeconds: 4, targetEndSeconds: 18 },
        { id: "reveal", priority: "P0", targetStartSeconds: 18, targetEndSeconds: 24 },
    ],
    beats: [
        { id: "b1", sourceEventId: "hook", startSeconds: 0, endSeconds: 4 },
        { id: "b2", sourceEventId: "middle", startSeconds: 4, endSeconds: 18 },
        { id: "b3", sourceEventId: "reveal", startSeconds: 18, endSeconds: 24 },
    ],
};

describe("viral remake duration planning", () => {
    test("defaults to the full source duration", () => {
        const result = planViralDurationExecution(template, { maxSeconds: 30, supportsContinuation: false });
        assert.equal(result.status, "ready");
        assert.equal(result.targetDurationSeconds, 24);
        assert.equal(result.segments.length, 1);
    });

    test("uses one orchestration task with internal segments when route supports continuation", () => {
        const result = planViralDurationExecution(template, { maxSeconds: 10, supportsContinuation: true });
        assert.equal(result.status, "ready");
        assert.equal(result.paidTaskCount, 1);
        assert.deepEqual(result.segments.map((segment) => segment.durationSeconds), [10, 10, 4]);
    });

    test("compression preserves every P0 event", () => {
        const result = compressViralTemplateTimeline(template, 12, { minP0Seconds: 2 });
        assert.equal(result.status, "ready");
        assert.deepEqual(result.events.filter((event) => event.priority === "P0").map((event) => event.id), ["hook", "reveal"]);
        assert.equal(result.events.at(-1).targetEndSeconds, 12);
    });

    test("blocks instead of silently dropping P0 events when target is impossible", () => {
        const result = compressViralTemplateTimeline(template, 3, { minP0Seconds: 2 });
        assert.equal(result.status, "blocked");
        assert.match(result.reason, /P0/);
    });
});
