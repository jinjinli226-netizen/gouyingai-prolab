import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
    applyUniversalRemakeBindings,
    compareUniversalRemakeFidelity,
    remapUniversalExplicitBindings,
    resolveUniversalRemakeBindings,
} from "../src/lib/universal-viral-remake/index.ts";

const continuity = (label) => ({ entities: label, objects: label, camera: label, audio: label });
const sourceEntity = (id, placeholderId, kind = "product") => ({
    id,
    placeholderId,
    kind,
    identityFacts: `${id} source identity`,
    behavioralRole: `${id} source behavior`,
    evidenceIds: [],
    confidence: 1,
});
const replacementEntity = (id, kind = "product") => ({
    id,
    kind,
    identityFacts: `${id} replacement identity`,
    referenceAssetIds: [`asset-${id}`],
    confidence: 1,
});

const source = {
    schemaVersion: 1,
    id: "reconstruction-1",
    sourceVideoId: "video-1",
    durationSeconds: 8,
    aspectRatio: "9:16",
    entities: [sourceEntity("source-product", "@商品1"), sourceEntity("source-person", "@角色1", "person")],
    timelineUnits: [
        {
            id: "u1",
            sourceStartSeconds: 0,
            sourceEndSeconds: 4,
            parentShotIndex: 1,
            direction: "@角色1 从身体后方挤出 @商品1。",
            placeholderIds: ["@角色1", "@商品1"],
            evidenceIds: [],
            boundaryAfter: "continuous",
            safeContinuationPoints: [],
            startContinuity: continuity("start"),
            endContinuity: continuity("middle"),
        },
        {
            id: "u2",
            sourceStartSeconds: 4,
            sourceEndSeconds: 8,
            parentShotIndex: 1,
            direction: "@商品1 下坠并撞入前方容器。",
            placeholderIds: ["@商品1"],
            evidenceIds: [],
            boundaryAfter: "none",
            safeContinuationPoints: [],
            startContinuity: continuity("middle"),
            endContinuity: continuity("end"),
        },
    ],
    canonicalPrompt: "@角色1 从身体后方挤出 @商品1。\n@商品1 下坠并撞入前方容器。",
    evidence: [],
    verification: { status: "verified", confidence: 1, issues: [], repaired: false },
};

describe("universal viral remake entity binding", () => {
    test("allows a source-only remake with zero replacement assets", () => {
        const result = resolveUniversalRemakeBindings(source.entities, [], []);
        assert.equal(result.status, "ready");
        assert.deepEqual(result.bindings.map((binding) => binding.status), ["source-only", "source-only"]);
    });

    test("auto-binds one unambiguous replacement of the same kind", () => {
        const replacement = replacementEntity("replacement-product");
        const result = resolveUniversalRemakeBindings([source.entities[0]], [replacement], []);
        assert.equal(result.status, "ready");
        assert.equal(result.bindings[0].replacementEntityId, replacement.id);
        assert.equal(result.bindings[0].status, "auto-bound");
    });

    test("blocks ambiguous same-kind replacements until the user confirms a mapping", () => {
        const result = resolveUniversalRemakeBindings(
            [sourceEntity("source-a", "@商品1"), sourceEntity("source-b", "@商品2")],
            [replacementEntity("replacement-a"), replacementEntity("replacement-b")],
            [],
        );
        assert.equal(result.status, "needs-confirmation");
        assert.match(result.issues.join("\n"), /product/);
    });

    test("changes bound identity facts without rewriting the source timeline", () => {
        const replacement = replacementEntity("replacement-product");
        const resolution = resolveUniversalRemakeBindings([source.entities[0]], [replacement], []);
        const candidate = applyUniversalRemakeBindings({ ...source, entities: [source.entities[0]] }, [replacement], resolution.bindings, []);

        assert.equal(candidate.timelineUnits[0].direction, source.timelineUnits[0].direction);
        assert.equal(candidate.entityManifest[0].identityFacts, replacement.identityFacts);
        assert.deepEqual(candidate.entityManifest[0].referenceAssetIds, replacement.referenceAssetIds);
    });

    test("keeps uploaded replacement mappings when a new analysis changes source entity IDs", () => {
        const previous = [sourceEntity("old-product-id", "@商品1")];
        const next = [sourceEntity("new-product-id", "@商品1")];
        const bindings = remapUniversalExplicitBindings(previous, next, [{ sourceEntityId: "old-product-id", replacementEntityId: "replacement-product" }]);

        assert.deepEqual(bindings, [{ sourceEntityId: "new-product-id", replacementEntityId: "replacement-product" }]);
    });
});

describe("universal viral remake fidelity gate", () => {
    test("rejects an unauthorized action rewrite", () => {
        const candidate = applyUniversalRemakeBindings(source, [], resolveUniversalRemakeBindings(source.entities, [], []).bindings, []);
        candidate.timelineUnits[0] = { ...candidate.timelineUnits[0], direction: "@角色1 用手拿起并安装 @商品1。" };

        const report = compareUniversalRemakeFidelity({ source, candidate, patches: [] });
        assert.equal(report.passed, false);
        assert.equal(report.forbiddenChanges[0].kind, "timeline-direction");
        assert.match(report.forbiddenChanges[0].summary, /u1/);
    });

    test("rejects timing camera and audio drift outside an authorized patch", () => {
        const candidate = applyUniversalRemakeBindings(source, [], resolveUniversalRemakeBindings(source.entities, [], []).bindings, []);
        candidate.timelineUnits[1] = {
            ...candidate.timelineUnits[1],
            sourceStartSeconds: 5,
            startContinuity: { ...candidate.timelineUnits[1].startContinuity, camera: "different camera", audio: "different audio" },
        };

        const report = compareUniversalRemakeFidelity({ source, candidate, patches: [] });
        assert.equal(report.passed, false);
        assert.ok(report.forbiddenChanges.some((difference) => difference.kind === "timeline-timing"));
        assert.ok(report.forbiddenChanges.some((difference) => difference.kind === "continuity"));
    });

    test("allows an explicit patch only for its declared timeline unit", () => {
        const patch = {
            id: "patch-1",
            reason: "explicit-user-change",
            timelineUnitId: "u1",
            beforeDirection: source.timelineUnits[0].direction,
            afterDirection: "@角色1 推动 @商品1。",
        };
        const candidate = applyUniversalRemakeBindings(source, [], resolveUniversalRemakeBindings(source.entities, [], []).bindings, [patch]);
        const report = compareUniversalRemakeFidelity({ source, candidate, patches: [patch] });

        assert.equal(report.passed, true);
        assert.equal(report.forbiddenChanges.length, 0);
        assert.equal(report.allowedChanges[0].kind, "explicit-patch");
        assert.equal(candidate.timelineUnits[1].direction, source.timelineUnits[1].direction);
    });

    test("rejects a patch whose before text does not match the verified source", () => {
        const patch = {
            id: "patch-invalid",
            reason: "explicit-user-change",
            timelineUnitId: "u1",
            beforeDirection: "not the source direction",
            afterDirection: "new direction",
        };

        assert.throws(
            () => applyUniversalRemakeBindings(source, [], resolveUniversalRemakeBindings(source.entities, [], []).bindings, [patch]),
            /原片内容不匹配/,
        );
    });
});
