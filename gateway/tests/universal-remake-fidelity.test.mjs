import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
    buildUniversalFidelityCorrection,
    createUniversalFidelityPrompt,
    parseUniversalFidelityEvaluation,
} from "../src/universal-viral-remake/fidelity.ts";

const contract = {
    schemaVersion: 3,
    durationSeconds: 8,
    aspectRatio: "9:16",
    canonicalPrompt: "@角色1 背向镜头，@商品1 接触容器后才分离。",
    timelineUnits: [{
        id: "unit-1", sourceStartSeconds: 0, sourceEndSeconds: 8, direction: "@角色1 背向镜头，@商品1 接触容器后才分离。",
        structuralInvariants: [
            { id: "inv-facing", dimension: "主体朝向", description: "@角色1 背向镜头", importance: "critical" },
            { id: "inv-frame", dimension: "构图", description: "主体位于画面中央", importance: "supporting" },
        ],
        eventFacts: [{ id: "event-release", family: "relation-contact", dimension: "分离时机", predicate: "@商品1 接触容器后才与 @角色1 分离", startSeconds: 2, endSeconds: 7, importance: "critical" }],
        startContinuity: { facts: [{ dimension: "起态", description: "@角色1 低姿态蓄力", participantPlaceholderIds: ["@角色1"] }] },
        endContinuity: { facts: [{ dimension: "终态", description: "@商品1 留在容器内，@角色1 重新站起", participantPlaceholderIds: ["@角色1", "@商品1"] }] },
    }],
};

const candidate = {
    id: "candidate-1", index: 0,
    entityManifest: [{ placeholderId: "@角色1", identityFacts: "替换角色", physicalInstanceCount: 1 }],
    segments: [{ id: "segment-1", index: 0, prompt: "locked prompt", durationSeconds: 8, modelId: "video", referenceAssetIds: [] }],
    output: { kind: "direct-video" },
};

describe("universal remake generated-video fidelity", () => {
    test("builds an evidence-labelled comparison prompt from the dynamic fact graph", () => {
        const prompt = createUniversalFidelityPrompt(contract, candidate, 85);
        assert.match(prompt, /第 1 个参考素材是原片完整视频/);
        assert.match(prompt, /第 2 个参考素材是待验收成片/);
        assert.match(prompt, /inv-facing/);
        assert.match(prompt, /event-release/);
        assert.match(prompt, /continuity:unit-1:end:0/);
        assert.doesNotMatch(prompt, /牛排|落锅|手机壳/);
    });

    test("fails deterministically when a critical fact is contradicted", () => {
        const report = parseUniversalFidelityEvaluation(JSON.stringify({ factResults: [
            { factId: "inv-facing", status: "contradicted", issue: "主体朝向相反" },
            { factId: "inv-frame", status: "matched", issue: "" },
            { factId: "event-release", status: "matched", issue: "" },
            { factId: "continuity:unit-1:start:0", status: "matched", issue: "" },
            { factId: "continuity:unit-1:end:0", status: "matched", issue: "" },
            { factId: "entity:@角色1", status: "matched", issue: "" },
        ] }), contract, candidate, 85);

        assert.equal(report.passed, false);
        assert.deepEqual(report.missingFactIds, ["inv-facing"]);
        assert.ok(report.score < 100);
        const correction = buildUniversalFidelityCorrection(report);
        assert.match(correction, /@角色1 背向镜头/);
        assert.doesNotMatch(correction, /主体朝向相反/);
    });

    test("treats omitted and invented fact IDs as uncertain instead of trusting the model", () => {
        const report = parseUniversalFidelityEvaluation({ factResults: [
            { factId: "invented-action", status: "matched", issue: "" },
            { factId: "inv-facing", status: "matched", issue: "" },
        ] }, contract, candidate, 85);

        assert.equal(report.passed, false);
        assert.ok(report.missingFactIds.includes("event-release"));
        assert.ok(report.issues.some((issue) => issue.includes("未返回")));
        assert.ok(report.issues.every((issue) => !issue.includes("invented-action")));
    });

    test("passes only when all critical facts match and weighted coverage reaches the threshold", () => {
        const factIds = ["inv-facing", "inv-frame", "event-release", "continuity:unit-1:start:0", "continuity:unit-1:end:0", "entity:@角色1"];
        const report = parseUniversalFidelityEvaluation({ factResults: factIds.map((factId) => ({ factId, status: "matched", issue: "" })) }, contract, candidate, 85);
        assert.equal(report.passed, true);
        assert.equal(report.score, 100);
        assert.deepEqual(report.matchedFactIds, factIds);
        assert.deepEqual(report.missingFactIds, []);
    });
});
