import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { compileViralCandidateManifests } from "../src/lib/canvas/viral-video-batch-compiler.ts";

const template = {
    id: "template-1",
    bindings: [{ id: "binding-product", sourceObjectId: "source-product", replacementObjectId: "upload-product", status: "bound" }],
    events: [{ id: "explosion", priority: "P0", description: "火车爆破" }],
    continuityRules: ["同一人物与商品"],
};
const recipe = {
    id: "recipe-1",
    candidateCount: 8,
    seed: 42,
    fixedObjectIds: ["source-product"],
    variableSlots: [
        { id: "wardrobe", label: "服装", values: ["红色外套", "蓝色外套"] },
        { id: "scene", label: "场景", values: ["站台", "隧道"] },
    ],
};

describe("viral controlled candidate compiler", () => {
    test("deterministically compiles between one and one thousand complete candidates", () => {
        const first = compileViralCandidateManifests(template, { ...recipe, candidateCount: 1000 });
        const second = compileViralCandidateManifests(template, { ...recipe, candidateCount: 1000 });
        assert.equal(first.length, 1000);
        assert.deepEqual(first, second);
        assert.equal(compileViralCandidateManifests(template, { ...recipe, candidateCount: 0 }).length, 1);
    });

    test("covers slot combinations before repeating them with new seeds", () => {
        const candidates = compileViralCandidateManifests(template, recipe);
        assert.equal(new Set(candidates.slice(0, 4).map((item) => JSON.stringify(item.slotSelections))).size, 4);
        assert.deepEqual(candidates[0].slotSelections, candidates[4].slotSelections);
        assert.notEqual(candidates[0].seed, candidates[4].seed);
    });

    test("keeps P0 events and fixed bindings immutable in every candidate", () => {
        const candidates = compileViralCandidateManifests(template, recipe);
        assert.equal(candidates.every((item) => item.fixedBindings[0].replacementObjectId === "upload-product"), true);
        assert.equal(candidates.every((item) => item.prompt.includes("P0 explosion：火车爆破")), true);
        assert.equal(candidates.every((item) => item.prompt.includes("source-product→upload-product")), true);
    });
});
