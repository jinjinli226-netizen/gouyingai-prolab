import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { planUniversalRemakeSegments } from "../src/lib/universal-viral-remake/segmentation.ts";

const continuity = (label) => ({
    entities: `${label}-entities`,
    objects: `${label}-objects`,
    camera: `${label}-camera`,
    audio: `${label}-audio`,
});

const unit = (id, start, end, boundaryAfter = "semantic", overrides = {}) => ({
    id,
    sourceStartSeconds: start,
    sourceEndSeconds: end,
    parentShotIndex: 1,
    direction: `${id} source-grounded direction`,
    placeholderIds: ["@角色1"],
    evidenceIds: [`evidence-${id}`],
    boundaryAfter,
    safeContinuationPoints: [],
    startContinuity: continuity(`${id}-start`),
    endContinuity: continuity(`${id}-end`),
    ...overrides,
});

const reconstruction = (durationSeconds, timelineUnits) => ({
    schemaVersion: 1,
    id: "reconstruction-1",
    sourceVideoId: "video-1",
    durationSeconds,
    aspectRatio: "9:16",
    entities: [],
    timelineUnits,
    canonicalPrompt: timelineUnits.map((item) => item.direction).join("\n"),
    evidence: [],
    verification: { status: "verified", confidence: 1, issues: [], repaired: false },
});

describe("universal viral remake semantic segmentation", () => {
    test("keeps a short source video as one complete generation segment", () => {
        const result = planUniversalRemakeSegments(
            reconstruction(8, [unit("u1", 0, 3), unit("u2", 3, 8, "none")]),
            { maxDurationSeconds: 15 },
        );

        assert.equal(result.status, "ready");
        assert.equal(result.segments.length, 1);
        assert.equal(result.segments[0].sourceStartSeconds, 0);
        assert.equal(result.segments[0].sourceEndSeconds, 8);
        assert.equal(result.segments[0].durationSeconds, 8);
        assert.deepEqual(result.segments[0].timelineUnitIds, ["u1", "u2"]);
    });

    test("packs a long source at the latest semantic boundary below the model limit", () => {
        const result = planUniversalRemakeSegments(
            reconstruction(31, [
                unit("u1", 0, 5),
                unit("u2", 5, 12, "hard-cut"),
                unit("u3", 12, 20, "continuous"),
                unit("u4", 20, 24),
                unit("u5", 24, 31, "none"),
            ]),
            { maxDurationSeconds: 15 },
        );

        assert.equal(result.status, "ready");
        assert.deepEqual(
            result.segments.map((segment) => [segment.sourceStartSeconds, segment.sourceEndSeconds]),
            [[0, 12], [12, 24], [24, 31]],
        );
        assert.ok(result.segments.every((segment) => segment.durationSeconds <= 15));
        assert.equal(result.segments[0].boundaryAfter, "hard-cut");
    });

    test("splits one overlong continuous unit only at declared safe continuation points", () => {
        const middle = continuity("middle");
        const result = planUniversalRemakeSegments(
            reconstruction(22, [
                unit("u1", 0, 22, "none", {
                    safeContinuationPoints: [{ atSeconds: 11, continuity: middle }],
                }),
            ]),
            { maxDurationSeconds: 15 },
        );

        assert.equal(result.status, "ready");
        assert.deepEqual(
            result.segments.map((segment) => [segment.sourceStartSeconds, segment.sourceEndSeconds]),
            [[0, 11], [11, 22]],
        );
        assert.deepEqual(result.segments[0].continuityOut, middle);
        assert.deepEqual(result.segments[1].continuityIn, middle);
        assert.equal(result.segments[0].boundaryAfter, "continuous");
    });

    test("requests refinement instead of hard-cutting an overlong unit with no safe point", () => {
        const result = planUniversalRemakeSegments(
            reconstruction(22, [unit("u1", 0, 22, "none")]),
            { maxDurationSeconds: 15 },
        );

        assert.equal(result.status, "needs-refinement");
        assert.match(result.issues.join("\n"), /u1/);
        assert.match(result.issues.join("\n"), /安全延续点/);
    });

    test("carries entity object camera and audio continuity into adjacent segments", () => {
        const result = planUniversalRemakeSegments(
            reconstruction(20, [
                unit("u1", 0, 10, "continuous"),
                unit("u2", 10, 20, "none", { startContinuity: continuity("u1-end") }),
            ]),
            { maxDurationSeconds: 10 },
        );

        assert.equal(result.status, "ready");
        assert.deepEqual(result.segments[0].continuityOut, continuity("u1-end"));
        assert.deepEqual(result.segments[1].continuityIn, continuity("u1-end"));
        assert.deepEqual(Object.keys(result.segments[0].continuityOut).sort(), ["audio", "camera", "entities", "objects"]);
    });
});
