import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
    VIRAL_VIDEO_DOMAIN_SCHEMA_VERSION,
    createViralBatchRecipe,
    normalizeViralCandidateCount,
    validateViralDomainRecord,
} from "../src/lib/canvas/viral-video-domain.ts";
import { buildViralVideoRemakeProject } from "../src/lib/canvas/viral-video-remake-workflow.ts";

const coverage = {
    schemaVersion: 1,
    id: "coverage-1",
    sourceEventCount: 1,
    mappedEventCount: 1,
    p0Count: 1,
    mappedP0Count: 1,
    sourceSceneCount: 1,
    mappedSceneCount: 1,
    sourceDialogueCount: 0,
    mappedDialogueCount: 0,
    missingEventIds: [],
    missingP0EventIds: [],
    passed: true,
    issues: [],
};

describe("viral remake domain", () => {
    test("normalizes complete candidate count to 1-1000 and defaults to one", () => {
        assert.equal(normalizeViralCandidateCount(undefined), 1);
        assert.equal(normalizeViralCandidateCount(Number.NaN), 1);
        assert.equal(normalizeViralCandidateCount(0), 1);
        assert.equal(normalizeViralCandidateCount(7.9), 7);
        assert.equal(normalizeViralCandidateCount(1001), 1000);
    });

    test("creates a safe batch recipe without implicit pilots or retries", () => {
        const recipe = createViralBatchRecipe({ candidateCount: 12, seed: 91 });

        assert.equal(recipe.schemaVersion, VIRAL_VIDEO_DOMAIN_SCHEMA_VERSION);
        assert.equal(recipe.candidateCount, 12);
        assert.equal(recipe.pilotCount, 0);
        assert.equal(recipe.autoContinueAfterPilot, false);
        assert.equal(recipe.maxQualityRetries, 0);
        assert.deepEqual(recipe.fixedObjectIds, []);
        assert.deepEqual(recipe.variableSlots, []);
    });

    test("stores complete candidate count instead of plan variant count in workflow state", () => {
        const workflow = buildViralVideoRemakeProject().workflow;

        assert.equal(workflow.candidateCount, 1);
        assert.equal("batchCount" in workflow, false);
    });

    test("validates every persisted viral remake domain record", () => {
        const object = {
            schemaVersion: 1,
            id: "object-product",
            origin: "source-video",
            kind: "product",
            name: "mirror phone case",
            role: "hero-product",
            visualFacts: { colors: ["gray"], materials: [], shape: "rounded rectangle", markings: [], packaging: "", distinctiveFeatures: ["mirror panel"] },
            functionalFacts: ["protects phone"],
            shotIndexes: [1],
            referenceAssetIds: [],
            representativeFrameIds: ["frame-1"],
            confidence: 0.92,
        };
        const binding = {
            schemaVersion: 1,
            id: "binding-1",
            sourceObjectId: object.id,
            replacementObjectId: "upload-product",
            mode: "auto",
            status: "bound",
            confidence: 0.98,
            reason: "single hero product",
            affectedEventIds: ["event-hook"],
        };
        const event = {
            schemaVersion: 1,
            id: "event-hook",
            priority: "P0",
            function: "hook",
            sourceStartSeconds: 0,
            sourceEndSeconds: 1.2,
            targetStartSeconds: 0,
            targetEndSeconds: 1.2,
            parentShotIndex: 1,
            description: "truck opens",
            startState: "truck closed",
            endState: "products falling",
            involvedObjectIds: [object.id],
            audioCue: "impact",
            evidenceIds: ["frame-1"],
        };
        const template = {
            schemaVersion: 1,
            id: "template-1",
            title: "product avalanche",
            sourceDurationSeconds: 15,
            targetDurationSeconds: 15,
            aspectRatio: "9:16",
            hookMechanism: "unexpected avalanche",
            narrativeStructure: "hook-proof-cta",
            objects: [object],
            bindings: [binding],
            characterBible: { characters: [] },
            wardrobeTimeline: [],
            events: [event],
            beats: [],
            audioPlan: { voiceover: [], subtitles: [], soundEffects: [], music: [] },
            continuityRules: [],
            coverage,
        };
        const recipe = createViralBatchRecipe({ id: "recipe-1", candidateCount: 1 });
        const manifest = {
            schemaVersion: 1,
            id: "candidate-1",
            index: 0,
            templateId: template.id,
            seed: 1,
            slotSelections: {},
            fixedBindings: [binding],
            prompt: "complete prompt",
            status: "compiled",
        };
        const quality = {
            schemaVersion: 1,
            id: "quality-1",
            candidateId: manifest.id,
            totalScore: 90,
            eventCoverageScore: 30,
            timelineScore: 20,
            identityScore: 15,
            productScore: 15,
            audioScore: 5,
            visualScore: 5,
            missingP0EventIds: [],
            issues: [],
            evidence: [],
            decision: "pass",
        };

        assert.equal(validateViralDomainRecord("object", object), object);
        assert.equal(validateViralDomainRecord("binding", binding), binding);
        assert.equal(validateViralDomainRecord("event", event), event);
        assert.equal(validateViralDomainRecord("template", template), template);
        assert.equal(validateViralDomainRecord("recipe", recipe), recipe);
        assert.equal(validateViralDomainRecord("candidate", manifest), manifest);
        assert.equal(validateViralDomainRecord("coverage", coverage), coverage);
        assert.equal(validateViralDomainRecord("quality", quality), quality);
    });

    test("rejects records with unstable identity or unsupported schema", () => {
        assert.throws(() => validateViralDomainRecord("coverage", { ...coverage, id: "" }), /id/);
        assert.throws(() => validateViralDomainRecord("coverage", { ...coverage, schemaVersion: 2 }), /schemaVersion/);
    });
});
