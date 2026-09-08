import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
    UNIVERSAL_CAPABILITY_REGISTRY,
    applyUniversalRemakeBindings,
    compareUniversalRemakeFidelity,
    compileUniversalRemakeCandidates,
    withUniversalSourceVisualAnchors,
    normalizeUniversalRemakeCandidateCount,
    planUniversalRemakeSegments,
    resolveUniversalRemakeBindings,
    summarizeUniversalRemakeBatch,
} from "../src/lib/universal-viral-remake/index.ts";

const continuity = (label) => ({
    facts: [{ dimension: `${label}-dimension`, description: `${label}-state`, participantPlaceholderIds: [] }],
});
const sourceEntity = {
    id: "source-product",
    placeholderId: "@商品1",
    kind: "product",
    identityFacts: "source product identity",
    sourceAliases: ["source product"],
    behavioralRole: "keeps the same source behavior",
    physicalInstanceCount: 1,
    evidenceIds: [],
    confidence: 1,
};
const coverageFor = (facts) => UNIVERSAL_CAPABILITY_REGISTRY.map(({ family }) => {
    const factIds = facts.filter((fact) => fact.family === family).map((fact) => fact.id);
    return {
        family,
        status: factIds.length ? "observed" : "not-applicable",
        factIds,
        reason: factIds.length ? "原片可观察" : "本单元未出现该类内容",
        importance: factIds.length ? "critical" : "supporting",
    };
});
const makeUnit = (id, start, end, boundaryAfter = "semantic") => ({
    id,
    sourceStartSeconds: start,
    sourceEndSeconds: end,
    parentShotIndex: 1,
    direction: `${id}: @商品1 performs only the observed source action`,
    structuralInvariants: [{
        id: `${id}-invariant-1`,
        dimension: "本片自适应维度",
        description: "@商品1 remains the only center subject while the visible state changes exactly as observed",
        participantPlaceholderIds: ["@商品1"],
        evidenceIds: [],
        importance: "critical",
        confidence: 1,
    }],
    eventFacts: [{
        id: `${id}-state-1`,
        family: "state-transition",
        dimension: "可见状态变化",
        predicate: `@商品1 在 ${start.toFixed(3)}s–${end.toFixed(3)}s 按原片发生可见状态变化`,
        participantRoles: [{ placeholderId: "@商品1", role: "状态变化对象" }],
        startSeconds: start,
        endSeconds: end,
        evidenceIds: [],
        importance: "critical",
        confidence: 1,
        beforeState: "单元开始状态",
        afterState: "单元结束状态",
    }],
    capabilityCoverage: coverageFor([{
        id: `${id}-state-1`,
        family: "state-transition",
    }]),
    placeholderIds: ["@商品1"],
    evidenceIds: [],
    boundaryAfter,
    safeContinuationPoints: [],
    startContinuity: continuity(`${id}-start`),
    endContinuity: continuity(`${id}-end`),
});
const makeReconstruction = (durationSeconds, timelineUnits) => ({
    schemaVersion: 3,
    id: `reconstruction-${durationSeconds}`,
    sourceVideoId: "video-1",
    durationSeconds,
    aspectRatio: "9:16",
    entities: [sourceEntity],
    timelineUnits,
    canonicalPrompt: timelineUnits.map((unit) => unit.direction).join("\n"),
    evidence: [],
    verification: { status: "verified", confidence: 1, issues: [], repaired: false },
});

function makeTemplate(reconstruction, maxDurationSeconds) {
    const bindings = resolveUniversalRemakeBindings(reconstruction.entities, [], []).bindings;
    const bound = applyUniversalRemakeBindings(reconstruction, [], bindings, []);
    const segmentPlan = planUniversalRemakeSegments(reconstruction, { maxDurationSeconds });
    assert.equal(segmentPlan.status, "ready");
    const fidelity = compareUniversalRemakeFidelity({ source: reconstruction, candidate: bound, patches: [] });
    assert.equal(fidelity.passed, true);
    return { id: `template-${reconstruction.durationSeconds}`, ...bound, segmentPlan, fidelity, patches: [] };
}

const capabilities = { modelId: "video-model", maxDurationSeconds: 15, supportsContinuationFrame: true, generatesAudio: true };

describe("universal remake prompt and execution compiler", () => {
    test("compiles verified source facts into a concrete timed event state machine", () => {
        const unit = makeUnit("u1", 0, 8, "none");
        unit.placeholderIds = ["@actor1", "@object1", "@receiver1"];
        unit.structuralInvariants = [{
            ...unit.structuralInvariants[0],
            description: "@actor1 保持背对镜头的弯曲姿态，@object1 沿原片路径进入并接触 @receiver1",
            participantPlaceholderIds: ["@actor1", "@object1", "@receiver1"],
        }];
        unit.eventFacts = [
            {
                id: "orientation",
                family: "spatial-geometry",
                dimension: "主体朝向与相对位置",
                predicate: "@actor1 全程背对镜头，位于 @receiver1 后方和上方",
                participantRoles: [{ placeholderId: "@actor1", role: "动作主体" }, { placeholderId: "@receiver1", role: "接收对象" }],
                startSeconds: 0,
                endSeconds: 8,
                evidenceIds: [],
                importance: "critical",
                confidence: 0.98,
                beforeState: "@actor1 背对镜头站在 @receiver1 后上方",
                afterState: "@actor1 仍背对镜头",
            },
            {
                id: "pose",
                family: "pose-deformation",
                dimension: "蓄力姿态",
                predicate: "@actor1 先弯腰下蹲并保持臀部朝向镜头",
                participantRoles: [{ placeholderId: "@actor1", role: "动作主体" }],
                startSeconds: 0,
                endSeconds: 2.5,
                evidenceIds: [],
                importance: "critical",
                confidence: 0.96,
                beforeState: "身体略微弯曲",
                afterState: "身体明显下蹲并向前弯折",
            },
            {
                id: "path",
                family: "motion-path",
                dimension: "出现位置与运动路径",
                predicate: "@object1 从 @actor1 身体下后方出现，沿连续向下路径移动到 @receiver1",
                participantRoles: [{ placeholderId: "@object1", role: "移动对象" }, { placeholderId: "@actor1", role: "来源主体" }, { placeholderId: "@receiver1", role: "路径终点" }],
                startSeconds: 2.5,
                endSeconds: 5.5,
                evidenceIds: [],
                importance: "critical",
                confidence: 0.97,
                beforeState: "@object1 尚未出现",
                afterState: "@object1 到达 @receiver1 内部上方",
            },
            {
                id: "contact-release",
                family: "relation-contact",
                dimension: "接触与释放顺序",
                predicate: "@object1 先接触 @receiver1，再与 @actor1 完全分离并停留在 @receiver1 中",
                participantRoles: [{ placeholderId: "@object1", role: "被释放对象" }, { placeholderId: "@receiver1", role: "接收对象" }, { placeholderId: "@actor1", role: "释放主体" }],
                startSeconds: 5.5,
                endSeconds: 6.2,
                evidenceIds: [],
                importance: "critical",
                confidence: 0.97,
                beforeState: "@object1 正在接近 @receiver1",
                afterState: "@object1 已与 @actor1 分离并接触 @receiver1",
            },
            {
                id: "terminal",
                family: "state-transition",
                dimension: "终止状态",
                predicate: "@object1 保持在 @receiver1 中并出现原片可见的后续状态变化",
                participantRoles: [{ placeholderId: "@object1", role: "终态对象" }, { placeholderId: "@receiver1", role: "终态容器" }],
                startSeconds: 6.2,
                endSeconds: 8,
                evidenceIds: [],
                importance: "critical",
                confidence: 0.94,
                beforeState: "刚完成接触",
                afterState: "稳定停留并完成状态变化",
            },
        ];
        unit.capabilityCoverage = coverageFor(unit.eventFacts);
        const reconstruction = makeReconstruction(8, [unit]);
        reconstruction.entities = [
            { ...sourceEntity, id: "actor", placeholderId: "@actor1", kind: "person", identityFacts: "原片主体", behavioralRole: "执行原片动作" },
            { ...sourceEntity, id: "object", placeholderId: "@object1", identityFacts: "原片移动对象", behavioralRole: "沿原片路径移动" },
            { ...sourceEntity, id: "receiver", placeholderId: "@receiver1", kind: "prop", identityFacts: "原片接收对象", behavioralRole: "接收移动对象" },
        ];
        const [candidate] = compileUniversalRemakeCandidates(makeTemplate(reconstruction, 15), { count: 1, seed: 1, variableSlots: [] }, capabilities);
        const prompt = candidate.segments[0].prompt;

        assert.match(prompt, /VERIFIED EVENT STATE MACHINE/);
        assert.match(prompt, /0\.000s–2\.500s.*弯腰下蹲/);
        assert.match(prompt, /2\.500s–5\.500s.*身体下后方.*连续向下路径/);
        assert.match(prompt, /5\.500s–6\.200s.*先接触.*完全分离/);
        assert.match(prompt, /INITIAL STATE.*背对镜头/);
        assert.match(prompt, /TERMINAL STATE.*稳定停留/);
        assert.match(prompt, /PHYSICAL INSTANCE COUNT/);
        assert.match(prompt, /@actor1=1/);
        assert.match(prompt, /EVIDENCE-DERIVED NEGATIVE CONSTRAINTS/);
        assert.match(prompt, /不得把背对镜头改成正对镜头/);
        assert.match(prompt, /不得复制或增加物理实例/);
    });

    test("compiles one short source into one segment request and one logical direct result", () => {
        const reconstruction = makeReconstruction(8, [makeUnit("u1", 0, 8, "none")]);
        const [candidate] = compileUniversalRemakeCandidates(makeTemplate(reconstruction, 15), { count: 1, seed: 4, variableSlots: [] }, capabilities);

        assert.equal(candidate.segments.length, 1);
        assert.equal(candidate.output.kind, "direct-video");
        assert.equal(candidate.totalGeneratedSeconds, 8);
        assert.equal(candidate.segments[0].durationSeconds, 8);
        assert.match(candidate.segments[0].prompt, /u1: @商品1 performs only the observed source action/);
        assert.match(candidate.segments[0].prompt, /source product identity/);
        assert.match(candidate.segments[0].prompt, /SOURCE-VERIFIED INVARIANTS/);
        assert.match(candidate.segments[0].prompt, /本片自适应维度/);
        assert.doesNotMatch(candidate.segments[0].prompt, /ACTION GEOMETRY/);
    });

    test("uses one persisted source storyboard as a visual anchor for an exact source-only remake", () => {
        const reconstruction = makeReconstruction(8, [makeUnit("u1", 0, 8, "none")]);
        const template = withUniversalSourceVisualAnchors(makeTemplate(reconstruction, 15), ["canvas-artifact:local/source-storyboard"]);
        const [candidate] = compileUniversalRemakeCandidates(template, { count: 1, seed: 4, variableSlots: [] }, capabilities);

        assert.deepEqual(candidate.segments[0].referenceAssetIds, ["canvas-artifact:local/source-storyboard"]);
        assert.deepEqual(candidate.entityManifest[0].referenceAssetIds, ["canvas-artifact:local/source-storyboard"]);
    });

    test("gives each generated segment only source anchors from its own time range", () => {
        const reconstruction = makeReconstruction(24, [
            makeUnit("u1", 0, 12, "hard-cut"),
            makeUnit("u2", 12, 24, "none"),
        ]);
        const template = withUniversalSourceVisualAnchors(
            makeTemplate(reconstruction, 15),
            ["storyboard", "anchor-0", "anchor-6", "anchor-18", "anchor-23"],
            [0, 6, 18, 23],
        );

        const [candidate] = compileUniversalRemakeCandidates(template, { count: 1, seed: 4, variableSlots: [] }, capabilities);

        assert.deepEqual(candidate.segments[0].referenceAssetIds, ["anchor-0", "anchor-6"]);
        assert.deepEqual(candidate.segments[1].referenceAssetIds, ["anchor-18", "anchor-23"]);
        assert.ok(candidate.segments.every((segment) => !segment.referenceAssetIds.includes("storyboard")));
    });

    test("does not leak the old source storyboard into a replacement-object remake", () => {
        const reconstruction = makeReconstruction(8, [makeUnit("u1", 0, 8, "none")]);
        const template = makeTemplate(reconstruction, 15);
        template.entityManifest[0] = {
            ...template.entityManifest[0],
            replacementEntityId: "replacement-product",
            identityFacts: "replacement product",
            referenceAssetIds: ["replacement-image"],
        };

        const anchored = withUniversalSourceVisualAnchors(template, ["canvas-artifact:local/source-storyboard"]);

        assert.deepEqual(anchored.entityManifest[0].referenceAssetIds, ["replacement-image"]);
    });

    test("routes a fractional single segment through composition so provider rounding is trimmed", () => {
        const reconstruction = makeReconstruction(8.033, [makeUnit("u1", 0, 8.033, "none")]);
        const [candidate] = compileUniversalRemakeCandidates(makeTemplate(reconstruction, 15), { count: 1, seed: 4, variableSlots: [] }, capabilities);

        assert.equal(candidate.segments.length, 1);
        assert.equal(candidate.output.kind, "composed-video");
        assert.equal(candidate.output.targetDurationSeconds, 8.033);
        assert.deepEqual(candidate.output.orderedSegmentIds, [candidate.segments[0].id]);
    });

    test("a replacement prompt cannot leak or retain the old product identity", () => {
        const reconstruction = makeReconstruction(8, [makeUnit("u1", 0, 8, "none")]);
        reconstruction.entities[0] = {
            ...reconstruction.entities[0],
            identityFacts: "raw steak",
            sourceAliases: ["raw steak", "frying pan"],
            behavioralRole: "acts as a raw steak expelled into a frying pan",
        };
        reconstruction.timelineUnits[0].startContinuity.facts = [{ dimension: "物体关系", description: "raw steak waits above the frying pan", participantPlaceholderIds: ["@商品1"] }];
        reconstruction.timelineUnits[0].endContinuity.facts = [{ dimension: "物体关系", description: "raw steak rests inside the frying pan", participantPlaceholderIds: ["@商品1"] }];
        reconstruction.timelineUnits[0].structuralInvariants[0].description = "raw steak remains above the frying pan until the observed state change";
        const replacement = { id: "phone-case", kind: "product", identityFacts: "weathered spider-pattern phone case", referenceAssetIds: ["case-image"], confidence: 1 };
        const bindings = resolveUniversalRemakeBindings(reconstruction.entities, [replacement], []).bindings;
        const bound = applyUniversalRemakeBindings(reconstruction, [replacement], bindings, []);
        const segmentPlan = planUniversalRemakeSegments(reconstruction, { maxDurationSeconds: 15 });
        assert.equal(segmentPlan.status, "ready");
        const fidelity = compareUniversalRemakeFidelity({ source: reconstruction, candidate: bound, patches: [] });
        const template = { id: "replacement-template", ...bound, segmentPlan, fidelity, patches: [] };
        const [candidate] = compileUniversalRemakeCandidates(template, { count: 1, seed: 1, variableSlots: [] }, capabilities);
        const prompt = candidate.segments[0].prompt;

        assert.match(prompt, /weathered spider-pattern phone case/);
        assert.doesNotMatch(prompt, /raw steak|frying pan/i);
        assert.match(prompt, /REFERENCE ASSET MAP/);
        assert.match(prompt, /REFERENCE IMAGE 1\s*=\s*@商品1/);
        assert.match(prompt, /REPLACEMENT EXCLUSIVITY/);
        assert.match(prompt, /CONSTRAINED AFFORDANCE ADAPTATION/);
        assert.match(prompt, /只允许调整.*终止状态/);
        assert.match(prompt, /不得改变.*姿态.*方向.*路径.*接触.*释放.*节奏.*因果/);
        assert.match(prompt, /无法按字面成立/);
    });

    test("the paid-call compiler blocks a persisted legacy template before submission", () => {
        const reconstruction = makeReconstruction(8, [makeUnit("u1", 0, 8, "none")]);
        const template = makeTemplate(reconstruction, 15);
        delete template.timelineUnits[0].structuralInvariants;

        assert.throws(
            () => compileUniversalRemakeCandidates(template, { count: 1, seed: 1, variableSlots: [] }, capabilities),
            /结构不变量.*重新拉片/,
        );
    });

    test("the fidelity gate rejects mutations to verified event facts or capability coverage", () => {
        const reconstruction = makeReconstruction(8, [makeUnit("u1", 0, 8, "none")]);
        const bindings = resolveUniversalRemakeBindings(reconstruction.entities, [], []).bindings;
        const bound = applyUniversalRemakeBindings(reconstruction, [], bindings, []);
        const mutated = structuredClone(bound);
        mutated.timelineUnits[0].eventFacts[0].predicate = "一套与原片不同的新动作";
        mutated.timelineUnits[0].capabilityCoverage[0].status = "uncertain";

        const fidelity = compareUniversalRemakeFidelity({ source: reconstruction, candidate: mutated, patches: [] });

        assert.equal(fidelity.passed, false);
        assert.match(fidelity.forbiddenChanges.map((item) => item.summary).join("；"), /事件事实/);
        assert.match(fidelity.forbiddenChanges.map((item) => item.summary).join("；"), /能力检查/);
    });

    test("compiles camera-only or audio-only invariants without requiring action fields", () => {
        const unit = makeUnit("u1", 0, 8, "none");
        unit.placeholderIds = [];
        unit.structuralInvariants = [{
            id: "u1-audio",
            dimension: "环境声节奏",
            description: "三个逐渐增强的敲击声决定剪辑节奏，画面没有主体动作",
            participantPlaceholderIds: [],
            evidenceIds: [],
            importance: "critical",
            confidence: 0.9,
        }];
        const reconstruction = makeReconstruction(8, [unit]);
        const [candidate] = compileUniversalRemakeCandidates(makeTemplate(reconstruction, 15), { count: 1, seed: 4, variableSlots: [] }, capabilities);

        assert.match(candidate.segments[0].prompt, /环境声节奏/);
        assert.match(candidate.segments[0].prompt, /画面没有主体动作/);
        assert.doesNotMatch(candidate.segments[0].prompt, /朝向|发力姿态|接触或出现起点|运动轨迹|落点/);
    });

    test("compiles one long source into ordered segment requests and one composed result", () => {
        const reconstruction = makeReconstruction(31, [
            makeUnit("u1", 0, 12, "hard-cut"),
            makeUnit("u2", 12, 24, "semantic"),
            makeUnit("u3", 24, 31, "none"),
        ]);
        const [candidate] = compileUniversalRemakeCandidates(makeTemplate(reconstruction, 15), { count: 1, seed: 4, variableSlots: [] }, capabilities);

        assert.deepEqual(candidate.segments.map((segment) => segment.durationSeconds), [12, 12, 7]);
        assert.equal(candidate.output.kind, "composed-video");
        assert.deepEqual(candidate.output.orderedSegmentIds, candidate.segments.map((segment) => segment.id));
        assert.equal(candidate.output.targetDurationSeconds, 31);
        assert.equal(candidate.segments[1].continuationFrameFromSegmentId, candidate.segments[0].id);
        assert.match(candidate.segments[1].prompt, /CONTINUITY IN/);
        assert.match(candidate.segments[1].prompt, /CONTINUITY OUT/);
    });

    test("normalizes candidate count to 1-1000 without forcing a batch", () => {
        assert.equal(normalizeUniversalRemakeCandidateCount(undefined), 1);
        assert.equal(normalizeUniversalRemakeCandidateCount(0), 1);
        assert.equal(normalizeUniversalRemakeCandidateCount(12.8), 12);
        assert.equal(normalizeUniversalRemakeCandidateCount(1001), 1000);
    });

    test("reuses one template and fixed bindings across 1000 candidates", () => {
        const reconstruction = makeReconstruction(8, [makeUnit("u1", 0, 8, "none")]);
        const template = makeTemplate(reconstruction, 15);
        const candidates = compileUniversalRemakeCandidates(template, { count: 1000, seed: 9, variableSlots: [] }, capabilities);

        assert.equal(candidates.length, 1000);
        assert.ok(candidates.every((candidate) => candidate.templateId === template.id));
        assert.ok(candidates.every((candidate) => JSON.stringify(candidate.entityManifest) === JSON.stringify(candidates[0].entityManifest)));
        assert.ok(candidates.every((candidate) => candidate.segments.length === 1));
    });

    test("changes only explicitly declared variable slots for a whole candidate", () => {
        const reconstruction = makeReconstruction(8, [makeUnit("u1", 0, 8, "none")]);
        const template = makeTemplate(reconstruction, 15);
        const variableSlots = [{
            id: "product-color",
            targetPlaceholderId: "@商品1",
            options: [
                { id: "red", identityFacts: "red product", referenceAssetIds: ["red-image"] },
                { id: "blue", identityFacts: "blue product", referenceAssetIds: ["blue-image"] },
            ],
        }];
        const candidates = compileUniversalRemakeCandidates(template, { count: 2, seed: 1, variableSlots }, capabilities);

        assert.deepEqual(candidates.map((candidate) => candidate.slotSelections["product-color"]), ["red", "blue"]);
        assert.deepEqual(candidates.map((candidate) => candidate.entityManifest[0].identityFacts), ["red product", "blue product"]);
        assert.ok(candidates.every((candidate) => candidate.segments[0].prompt.includes(candidate.entityManifest[0].identityFacts)));
    });

    test("summarizes total provider calls and generated seconds before paid submission", () => {
        const reconstruction = makeReconstruction(31, [
            makeUnit("u1", 0, 12, "hard-cut"),
            makeUnit("u2", 12, 24),
            makeUnit("u3", 24, 31, "none"),
        ]);
        const candidates = compileUniversalRemakeCandidates(makeTemplate(reconstruction, 15), { count: 3, seed: 1, variableSlots: [] }, capabilities);
        const summary = summarizeUniversalRemakeBatch(candidates);

        assert.deepEqual(summary, { candidateCount: 3, segmentCallCount: 9, compositionCallCount: 3, totalGeneratedSeconds: 93 });
    });
});
