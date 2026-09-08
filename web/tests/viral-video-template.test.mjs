import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
    buildViralRemakeTemplate,
    buildViralVideoTemplateNode,
    evaluateViralTemplateCoverage,
} from "../src/lib/canvas/viral-video-template.ts";

const object = (id, kind, role) => ({
    schemaVersion: 1, id, origin: "source-video", kind, name: id, role,
    visualFacts: { colors: [], materials: [], shape: "", markings: [], packaging: "", distinctiveFeatures: [] },
    functionalFacts: [], shotIndexes: [1], referenceAssetIds: [], representativeFrameIds: [], confidence: 1,
});
const event = (id, priority, start, end, parentShotIndex = 1) => ({
    schemaVersion: 1, id, priority, function: priority === "P0" ? "spectacle" : "context",
    sourceStartSeconds: start, sourceEndSeconds: end, targetStartSeconds: start, targetEndSeconds: end,
    parentShotIndex, description: id, startState: `${id}-start`, endState: `${id}-end`,
    involvedObjectIds: ["product"], audioCue: "", evidenceIds: [],
});
const analysis = {
    title: "爆款结构", durationSeconds: 12, aspectRatio: "9:16", hook: "突发事件", narrativeStructure: "钩子-追逐-揭示",
    editRhythm: "快", visualStyle: "手机实拍", soundStrategy: "环境声", transferableCore: "强反差",
    objects: [object("product", "product", "hero-product"), object("person", "person", "character")],
    mustKeepEvents: [event("hook", "P0", 0, 2), event("context", "P1", 2, 6), event("reveal", "P0", 6, 12, 2)],
    sourceEvidence: [], audioEvidenceAvailable: true,
    shots: [
        { index: 1, parentShotIndex: 1, startSeconds: 0, endSeconds: 6, durationSeconds: 6, cameraMovement: "跟拍", action: "发生事件" },
        { index: 2, parentShotIndex: 2, startSeconds: 6, endSeconds: 12, durationSeconds: 6, cameraMovement: "推进", action: "完成揭示" },
    ],
};

describe("viral remake master template", () => {
    test("maps every source P0 event exactly once and in order", () => {
        const template = buildViralRemakeTemplate(analysis, [], undefined);
        assert.deepEqual(template.beats.map((beat) => beat.sourceEventId), ["hook", "context", "reveal"]);
        assert.equal(template.coverage.passed, true);
        assert.equal(template.coverage.mappedP0Count, 2);
    });

    test("coverage blocks a missing P0 spectacle", () => {
        const report = evaluateViralTemplateCoverage(analysis.mustKeepEvents, [
            { id: "beat-hook", sourceEventId: "hook" },
            { id: "beat-context", sourceEventId: "context" },
        ]);
        assert.equal(report.passed, false);
        assert.deepEqual(report.missingP0EventIds, ["reveal"]);
    });

    test("builds one draggable master-template node rather than shot variants", () => {
        const template = buildViralRemakeTemplate(analysis, [], undefined);
        const node = buildViralVideoTemplateNode({ id: "template-node", position: { x: 10, y: 20 }, template, masterPrompt: "完整成片提示词", plannerPrompt: "策划提示词" });
        assert.equal(node.metadata.viralVideoPromptRole, "template");
        assert.equal(node.metadata.viralVideoRemakeTemplate.id, template.id);
        assert.equal(node.metadata.prompt, "完整成片提示词");
        assert.match(node.title, /复刻母版/);
    });
});
