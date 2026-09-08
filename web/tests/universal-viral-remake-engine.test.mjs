import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
    UNIVERSAL_CAPABILITY_REGISTRY,
    UNIVERSAL_REMAKE_SCHEMA_VERSION,
    createUniversalReconstructionPrompt,
    createUniversalVerificationPrompt,
    compileVerifiedUniversalRemake,
    prepareUniversalRemake,
    reconstructUniversalSource,
    verifyUniversalSourceReconstruction,
} from "../src/lib/universal-viral-remake/index.ts";
import { buildUniversalSourceAnchorTimes, buildUniversalStoryboardTimes } from "../src/lib/universal-viral-remake/storyboard.ts";

const continuity = (label) => ({
    facts: [{ dimension: `${label}-dimension`, description: `${label}-state`, participantPlaceholderIds: [] }],
});
const baseEventFact = {
    id: "fact-spatial-1",
    family: "spatial-geometry",
    dimension: "主体朝向",
    predicate: "@product1 背对镜头并位于接收区域上方",
    participantRoles: [{ placeholderId: "@product1", role: "主体" }],
    startSeconds: 0,
    endSeconds: 8,
    evidenceIds: ["frame-1"],
    importance: "critical",
    confidence: 0.95,
    beforeState: "@product1 背对镜头",
    afterState: "@product1 仍背对镜头",
};
const coverageFor = (facts) => UNIVERSAL_CAPABILITY_REGISTRY.map(({ family }) => {
    const factIds = facts.filter((fact) => fact.family === family).map((fact) => fact.id);
    return {
        family,
        status: factIds.length ? "observed" : "not-applicable",
        factIds,
        reason: factIds.length ? "原片证据中可直接观察" : "本时间单元未出现该类决定性内容",
        importance: factIds.length ? "critical" : "supporting",
    };
});
const reconstruction = {
    schemaVersion: 3,
    id: "reconstruction-1",
    sourceVideoId: "source-video",
    durationSeconds: 8,
    aspectRatio: "9:16",
    entities: [{
        id: "source-product",
        placeholderId: "@product1",
        kind: "product",
        identityFacts: "source product",
        sourceAliases: ["source product"],
        behavioralRole: "moves exactly as observed",
        physicalInstanceCount: 1,
        evidenceIds: ["frame-1"],
        confidence: 0.95,
    }],
    timelineUnits: [{
        id: "unit-1",
        sourceStartSeconds: 0,
        sourceEndSeconds: 8,
        parentShotIndex: 0,
        direction: "@product1 performs the observed action",
        structuralInvariants: [{
            id: "invariant-1",
            dimension: "画面主体关系",
            description: "@product1 是该时间单元唯一的中心视觉主体",
            participantPlaceholderIds: ["@product1"],
            evidenceIds: ["frame-1"],
            importance: "critical",
            confidence: 0.95,
        }],
        eventFacts: [baseEventFact],
        capabilityCoverage: coverageFor([baseEventFact]),
        placeholderIds: ["@product1"],
        evidenceIds: ["frame-1"],
        boundaryAfter: "none",
        safeContinuationPoints: [],
        startContinuity: continuity("start"),
        endContinuity: continuity("end"),
    }],
    canonicalPrompt: "@product1 performs the observed action",
    evidence: [{ id: "frame-1", atSeconds: 1, kind: "frame", artifactId: "artifact-1", description: "product moving" }],
    verification: { status: "pending", confidence: 0, issues: [], repaired: false },
};

const sourceInput = {
    sourceVideoId: "source-video",
    durationSeconds: 8,
    aspectRatio: "9:16",
    evidence: reconstruction.evidence,
};

describe("universal viral remake reconstruction engine", () => {
    test("schema v3 exposes a content-agnostic extraction capability registry", () => {
        assert.equal(UNIVERSAL_REMAKE_SCHEMA_VERSION, 3);
        assert.deepEqual(
            UNIVERSAL_CAPABILITY_REGISTRY.map((item) => item.family),
            [
                "entity-identity",
                "temporal-boundary",
                "spatial-geometry",
                "pose-deformation",
                "motion-path",
                "relation-contact",
                "state-transition",
                "camera-edit",
                "scene-treatment",
                "text-audio",
            ],
        );
        const serialized = JSON.stringify(UNIVERSAL_CAPABILITY_REGISTRY);
        assert.doesNotMatch(serialized, /牛排|手机壳|蜘蛛侠|锅|hook|reveal|CTA/i);
    });

    test("reconstruction prompt is adaptive and does not force one marketing story shape", () => {
        const prompt = createUniversalReconstructionPrompt(sourceInput);
        assert.match(prompt, /semantic event.*visual grammar.*audio.*text.*rhythm.*state boundary/i);
        assert.match(prompt, /evidence/i);
        assert.match(prompt, /safe continuation/i);
        assert.doesNotMatch(prompt, /must contain (?:a )?hook/i);
        assert.match(prompt, /do not impose a marketing formula/i);
        assert.doesNotMatch(prompt, /every\s+\d+\s+seconds/i);
    });

    test("reconstruction prompt declares the exact machine-readable output contract", () => {
        const prompt = createUniversalReconstructionPrompt(sourceInput);
        assert.match(prompt, /exact English property names/i);
        assert.match(prompt, /human-readable descriptive values in Simplified Chinese/i);
        assert.match(prompt, /"entities"\s*:/);
        assert.match(prompt, /"sourceAliases"\s*:/);
        assert.match(prompt, /"timelineUnits"\s*:/);
        assert.match(prompt, /"startContinuity"\s*:/);
        assert.match(prompt, /"safeContinuationPoints"\s*:/);
        assert.match(prompt, /"facts"\s*:/);
        assert.match(prompt, /"structuralInvariants"\s*:/);
        assert.match(prompt, /"dimension"\s*:/);
        assert.match(prompt, /"importance"\s*:/);
        assert.match(prompt, /choose.*dimension.*evidence/i);
        assert.match(prompt, /do not force.*motion/i);
        assert.match(prompt, /startContinuity and endContinuity may use an empty facts array/i);
        assert.match(prompt, /omit a safe continuation point unless.*continuity facts/i);
        assert.doesNotMatch(prompt, /"actionGeometry"\s*:/);
        assert.doesNotMatch(prompt, /"subjectOrientation"\s*:/);
        assert.doesNotMatch(prompt, /"interactionOrigin"\s*:/);
        assert.doesNotMatch(prompt, /"destinationOrContact"\s*:/);
        assert.doesNotMatch(prompt, /"startContinuity"\s*:\s*\{\s*"entities"/);
        assert.match(prompt, /refer to entities exclusively by placeholders/i);
        assert.match(prompt, /do not wrap/i);
    });

    test("reconstruction prompt audits every generic capability while compiling only observed facts", () => {
        const prompt = createUniversalReconstructionPrompt(sourceInput);
        assert.match(prompt, /entity-identity/);
        assert.match(prompt, /relation-contact/);
        assert.match(prompt, /text-audio/);
        assert.match(prompt, /observed.*not-observed.*not-applicable.*uncertain/i);
        assert.match(prompt, /physical instance count/i);
        assert.match(prompt, /multiple views.*multiple physical instances/i);
        assert.match(prompt, /initial state.*ordered.*terminal state/i);
        assert.match(prompt, /orientation.*source region.*destination region.*path.*contact.*release/i);
        assert.match(prompt, /silhouette.*proportions.*anatomy.*material/i);
        assert.match(prompt, /hidden-existing.*generated.*deformed.*separated/i);
        assert.match(prompt, /topological continuity/i);
        assert.match(prompt, /remains attached.*detachment/i);
        assert.match(prompt, /do not turn the capability catalog into required video content/i);
        assert.doesNotMatch(prompt, /牛排|手机壳|蜘蛛侠|锅/);
    });

    test("short videos use one bounded timestamped storyboard as evidence rather than a fixed semantic template", () => {
        const times = buildUniversalStoryboardTimes(8.033);
        assert.ok(times.length >= 6 && times.length <= 24);
        assert.equal(times[0], 0);
        assert.ok(times.at(-1) > 8);
    });

    test("derives a bounded set of generation keyframes from verified critical event timing", () => {
        const timed = structuredClone(reconstruction);
        timed.timelineUnits[0].eventFacts = [
            { ...baseEventFact, id: "f1", startSeconds: 0, endSeconds: 2 },
            { ...baseEventFact, id: "f2", startSeconds: 2, endSeconds: 6 },
            { ...baseEventFact, id: "f3", startSeconds: 6, endSeconds: 8 },
        ];

        const times = buildUniversalSourceAnchorTimes(timed, 8);

        assert.deepEqual(times, [0, 1, 2, 4, 6, 7, 7.98]);
        assert.ok(times.length <= 8);
    });

    test("accepts a non-action unit whose decisive structure is audio and text", async () => {
        const nonAction = structuredClone(reconstruction);
        nonAction.timelineUnits[0].direction = "固定画面中旁白与字幕共同推进信息";
        nonAction.timelineUnits[0].placeholderIds = [];
        nonAction.timelineUnits[0].structuralInvariants = [
            {
                id: "voiceover-order",
                dimension: "旁白与字幕同步关系",
                description: "每一句旁白出现时，同义字幕同步出现，画面主体保持静止",
                participantPlaceholderIds: [],
                evidenceIds: ["frame-1"],
                importance: "critical",
                confidence: 0.88,
            },
        ];
        nonAction.timelineUnits[0].eventFacts = [{
            ...baseEventFact,
            id: "fact-text-audio-1",
            family: "text-audio",
            dimension: "旁白与字幕同步关系",
            predicate: "每一句旁白出现时，同义字幕同步出现，画面主体保持静止",
            participantRoles: [],
        }];
        nonAction.timelineUnits[0].capabilityCoverage = coverageFor(nonAction.timelineUnits[0].eventFacts);

        const result = await reconstructUniversalSource(sourceInput, {
            understandVideo: async () => JSON.stringify(nonAction),
        });

        assert.equal(result.timelineUnits[0].structuralInvariants[0].dimension, "旁白与字幕同步关系");
        assert.equal(result.timelineUnits[0].eventFacts[0].family, "text-audio");
        assert.equal("actionGeometry" in result.timelineUnits[0], false);
    });

    test("normalizes omitted or legacy optional continuity without rejecting the whole reconstruction", async () => {
        const sparseContinuity = structuredClone(reconstruction);
        delete sparseContinuity.timelineUnits[0].startContinuity;
        sparseContinuity.timelineUnits[0].endContinuity = {
            camera: "固定机位保持不变",
            audio: "环境声延续",
        };
        sparseContinuity.timelineUnits[0].safeContinuationPoints = [{ atSeconds: 4 }];

        const result = await reconstructUniversalSource(sourceInput, {
            understandVideo: async () => JSON.stringify(sparseContinuity),
        });

        assert.deepEqual(result.timelineUnits[0].startContinuity, { facts: [] });
        assert.deepEqual(result.timelineUnits[0].endContinuity.facts.map((fact) => fact.description), ["固定机位保持不变", "环境声延续"]);
        assert.deepEqual(result.timelineUnits[0].safeContinuationPoints, []);
    });

    test("automatically asks the vision model to repair one invalid reconstruction before failing", async () => {
        const invalid = structuredClone(reconstruction);
        delete invalid.timelineUnits[0].structuralInvariants;
        const calls = [];

        const result = await reconstructUniversalSource(sourceInput, {
            understandVideo: async (request) => {
                calls.push(request);
                return JSON.stringify(calls.length === 1 ? invalid : reconstruction);
            },
        });

        assert.equal(result.timelineUnits[0].id, "unit-1");
        assert.equal(calls.length, 2);
        assert.deepEqual(calls.map((call) => call.phase), ["reconstruct", "reconstruct"]);
        assert.match(calls[1].prompt, /previous reconstruction failed local validation/i);
        assert.match(calls[1].prompt, /自适应结构不变量/);
        assert.match(calls[1].prompt, /return the complete corrected reconstruction/i);
    });

    test("completes an omitted capability-ledger family locally without another model call", async () => {
        const incomplete = structuredClone(reconstruction);
        incomplete.timelineUnits[0].capabilityCoverage = incomplete.timelineUnits[0].capabilityCoverage.slice(0, -1);
        const calls = [];

        const result = await reconstructUniversalSource(sourceInput, {
            understandVideo: async (request) => {
                calls.push(request);
                return JSON.stringify(incomplete);
            },
        });

        assert.equal(calls.length, 1);
        assert.equal(result.timelineUnits[0].capabilityCoverage.length, UNIVERSAL_CAPABILITY_REGISTRY.length);
        assert.deepEqual(result.timelineUnits[0].capabilityCoverage.at(-1), {
            family: "text-audio",
            status: "not-observed",
            factIds: [],
            reason: "本轮证据未形成该维度的可验证事件事实",
            importance: "supporting",
        });
    });

    test("keeps repairing an invalid reconstruction until a later response validates", async () => {
        const invalid = structuredClone(reconstruction);
        delete invalid.timelineUnits[0].structuralInvariants;
        const calls = [];

        const result = await reconstructUniversalSource(sourceInput, {
            understandVideo: async (request) => {
                calls.push(request);
                return JSON.stringify(calls.length < 4 ? invalid : reconstruction);
            },
        });

        assert.equal(result.timelineUnits[0].id, "unit-1");
        assert.equal(calls.length, 4);
        assert.ok(calls.slice(1).every((call) => /previous reconstruction failed local validation/i.test(call.prompt)));
    });

    test("reconstructs through the understanding port and validates the returned schema", async () => {
        const calls = [];
        const result = await reconstructUniversalSource(sourceInput, {
            understandVideo: async (request) => {
                calls.push(request);
                return JSON.stringify(reconstruction);
            },
        });
        assert.equal(calls.length, 1);
        assert.equal(calls[0].phase, "reconstruct");
        assert.equal(result.timelineUnits[0].id, "unit-1");
    });

    test("uses authoritative input metadata instead of trusting the model to echo opaque video identifiers", async () => {
        const modelResult = {
            ...reconstruction,
            sourceVideoId: "test.mp4",
            durationSeconds: 7.9,
            aspectRatio: "portrait",
        };
        const result = await reconstructUniversalSource(sourceInput, {
            understandVideo: async () => JSON.stringify(modelResult),
        });

        assert.equal(result.sourceVideoId, sourceInput.sourceVideoId);
        assert.equal(result.durationSeconds, sourceInput.durationSeconds);
        assert.equal(result.aspectRatio, sourceInput.aspectRatio);
    });

    test("accepts a reconstruction object wrapped by a vision provider", async () => {
        const result = await reconstructUniversalSource(sourceInput, {
            understandVideo: async () => JSON.stringify({ reconstruction }),
        });

        assert.equal(result.timelineUnits[0].id, "unit-1");
        assert.equal(result.sourceVideoId, sourceInput.sourceVideoId);
    });

    test("uses the same source evidence for an independent verification pass", async () => {
        const calls = [];
        const verified = await verifyUniversalSourceReconstruction(sourceInput, reconstruction, {
            understandVideo: async (request) => {
                calls.push(request);
                return JSON.stringify({ status: "verified", confidence: 0.97, issues: [] });
            },
        });
        assert.equal(calls[0].phase, "verify");
        assert.deepEqual(calls[0].evidence, sourceInput.evidence);
        assert.equal(verified.verification.status, "verified");
    });

    test("verification prompt declares a strict JSON envelope", () => {
        const prompt = createUniversalVerificationPrompt(sourceInput, reconstruction);
        assert.match(prompt, /exact English property names/i);
        assert.match(prompt, /human-readable descriptive values in Simplified Chinese/i);
        assert.match(prompt, /"status"\s*:/);
        assert.match(prompt, /"confidence"\s*:/);
        assert.match(prompt, /"issues"\s*:/);
        assert.match(prompt, /capability coverage ledger/i);
        assert.match(prompt, /every registered family/i);
        assert.match(prompt, /observed.*not-observed.*not-applicable.*uncertain/i);
        assert.match(prompt, /orientation.*source region.*destination region.*path.*contact.*release/i);
        assert.match(prompt, /silhouette.*proportions.*anatomy.*material/i);
        assert.match(prompt, /hidden-existing.*generated.*deformed.*separated/i);
        assert.match(prompt, /topological continuity/i);
        assert.match(prompt, /multi-view.*physical instance/i);
        assert.match(prompt, /do not require any family to be observed/i);
        assert.match(prompt, /static.*dialogue/i);
        assert.match(prompt, /do not wrap/i);
    });

    test("accepts a verification envelope wrapped by a vision provider", async () => {
        const verified = await verifyUniversalSourceReconstruction(sourceInput, reconstruction, {
            understandVideo: async () => JSON.stringify({ verification: { status: "verified", confidence: 0.96, issues: [] } }),
        });

        assert.equal(verified.verification.status, "verified");
        assert.equal(verified.verification.confidence, 0.96);
    });

    test("turns an evidence-sparsity rejection into one conservative repair pass", async () => {
        const repairedCopy = structuredClone(reconstruction);
        repairedCopy.timelineUnits[0].direction = "Only the sampled visible state transition, without unsupported mechanics";
        const calls = [];
        const verified = await verifyUniversalSourceReconstruction(sourceInput, reconstruction, {
            understandVideo: async (request) => {
                calls.push(request);
                if (calls.length === 1) {
                    return JSON.stringify({
                        status: "rejected",
                        confidence: 0.55,
                        issues: ["The sparse storyboard cannot establish the exact continuous deformation mechanics."],
                    });
                }
                return JSON.stringify({ status: "repaired", confidence: 0.9, issues: ["Unsupported mechanics removed"], reconstruction: repairedCopy });
            },
        });

        assert.equal(calls.length, 2);
        assert.match(calls[1].prompt, /sparse timestamped storyboard is the expected evidence format/i);
        assert.match(calls[1].prompt, /remove unsupported claims/i);
        assert.match(calls[1].prompt, /dimension names must come from this source rather than a fixed checklist/i);
        assert.equal(verified.timelineUnits[0].direction, repairedCopy.timelineUnits[0].direction);
        assert.equal(verified.verification.status, "repaired");
    });

    test("keeps repairing verifier rejections until independent verification passes", async () => {
        const calls = [];
        const verified = await verifyUniversalSourceReconstruction(sourceInput, reconstruction, {
            understandVideo: async (request) => {
                calls.push(request);
                if (calls.length < 4) {
                    return JSON.stringify({ status: "rejected", confidence: 0.5, issues: [`第 ${calls.length} 轮仍需校准`] });
                }
                return JSON.stringify({ status: "verified", confidence: 0.96, issues: [] });
            },
        });

        assert.equal(calls.length, 4);
        assert.equal(verified.verification.status, "verified");
        assert.ok(calls.slice(1).every((call) => /evidence-calibration repair/i.test(call.prompt)));
    });

    test("accepts a verifier repair and preserves its corrected reconstruction", async () => {
        const repairedCopy = structuredClone(reconstruction);
        repairedCopy.timelineUnits[0].direction = "repaired evidence-grounded direction";
        const repaired = await verifyUniversalSourceReconstruction(sourceInput, reconstruction, {
            understandVideo: async () => JSON.stringify({ status: "repaired", confidence: 0.91, issues: ["direction repaired"], reconstruction: repairedCopy }),
        });
        assert.equal(repaired.timelineUnits[0].direction, "repaired evidence-grounded direction");
        assert.equal(repaired.verification.repaired, true);
    });

    test("prepares one verified reusable template and candidate plan in strict order", async () => {
        const phases = [];
        const prepared = await prepareUniversalRemake({
            source: sourceInput,
            replacements: [{ id: "replacement-product", kind: "product", identityFacts: "red phone case", referenceAssetIds: ["asset-phone-case"], confidence: 1 }],
            explicitBindings: [],
            patches: [],
            recipe: { count: 2, seed: 7, variableSlots: [] },
            capabilities: { modelId: "model-video", maxDurationSeconds: 15, supportsContinuationFrame: true, generatesAudio: true },
        }, {
            understandVideo: async (request) => {
                phases.push(request.phase);
                if (request.phase === "reconstruct") return JSON.stringify(reconstruction);
                return JSON.stringify({ status: "verified", confidence: 0.98, issues: [] });
            },
        });

        assert.deepEqual(phases, ["reconstruct", "verify"]);
        assert.equal(prepared.status, "ready");
        assert.equal(prepared.template.entityManifest[0].identityFacts, "red phone case");
        assert.equal(prepared.candidates.length, 2);
        assert.deepEqual(prepared.summary, { candidateCount: 2, segmentCallCount: 2, compositionCallCount: 0, totalGeneratedSeconds: 16 });
    });

    test("blocks a legacy verified reconstruction that lacks replacement aliases or adaptive structural invariants", () => {
        const legacy = structuredClone(reconstruction);
        legacy.schemaVersion = 1;
        legacy.verification = { status: "verified", confidence: 1, issues: [], repaired: false };
        delete legacy.entities[0].sourceAliases;
        delete legacy.timelineUnits[0].structuralInvariants;
        legacy.timelineUnits[0].actionGeometry = {
            relativeLayout: "legacy",
            subjectOrientation: "legacy",
            poseAndMotion: "legacy",
            interactionOrigin: "legacy",
            trajectory: "legacy",
            destinationOrContact: "legacy",
            resultingState: "legacy",
        };

        const prepared = compileVerifiedUniversalRemake({
            reconstruction: legacy,
            replacements: [{ id: "replacement-product", kind: "product", identityFacts: "phone case", referenceAssetIds: ["case-image"], confidence: 1 }],
            explicitBindings: [],
            patches: [],
            recipe: { count: 1, seed: 1, variableSlots: [] },
            capabilities: { modelId: "video-model", maxDurationSeconds: 15, supportsContinuationFrame: true, generatesAudio: true },
        });

        assert.equal(prepared.status, "needs-refinement");
        assert.match(prepared.issues.join("；"), /重新拉片/);
        assert.match(prepared.issues.join("；"), /结构不变量/);
    });

    test("blocks a verified schema-v3 reconstruction whose capability audit is incomplete", () => {
        const incomplete = structuredClone(reconstruction);
        incomplete.verification = { status: "verified", confidence: 1, issues: [], repaired: false };
        incomplete.timelineUnits[0].capabilityCoverage = incomplete.timelineUnits[0].capabilityCoverage.slice(0, -1);

        const prepared = compileVerifiedUniversalRemake({
            reconstruction: incomplete,
            replacements: [],
            explicitBindings: [],
            patches: [],
            recipe: { count: 1, seed: 1, variableSlots: [] },
            capabilities: { modelId: "video-model", maxDurationSeconds: 15, supportsContinuationFrame: true, generatesAudio: true },
        });

        assert.equal(prepared.status, "needs-refinement");
        assert.match(prepared.issues.join("；"), /能力检查|事实证据/);
    });
});
