import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
    buildViralVideoEvidenceFrameTimes,
    findViralVideoSourceRecognitionQualityIssues,
    parseViralVideoSourceRecognition,
} from "../src/lib/canvas/viral-video-object-recognition.ts";
import { buildViralVideoAnalysisPrompt } from "../src/lib/canvas/viral-video-remake-workflow.ts";

const rawRecognition = {
    audioEvidenceAvailable: true,
    sourceEvidence: [
        { id: "frame-hook", kind: "frame", startSeconds: 0.2, description: "truck rear opens", confidence: 0.98 },
        { id: "audio-impact", kind: "audio", startSeconds: 0.6, endSeconds: 1.1, description: "impact and crowd reaction", confidence: 0.8 },
        { id: "frame-cta", kind: "frame", startSeconds: 14.4, description: "presenter holds product", confidence: 0.95 },
    ],
    objects: [
        { id: "truck", kind: "vehicle", name: "delivery truck", role: "supporting-object", visualFacts: { colors: ["white"], materials: ["metal"], shape: "box truck", markings: [], packaging: "", distinctiveFeatures: ["rear cargo doors"] }, functionalFacts: ["carries products"], shotIndexes: [1, 2], referenceAssetIds: [], representativeFrameIds: ["frame-hook"], confidence: 0.98 },
        { id: "case", kind: "product", name: "mirror phone case", role: "hero-product", visualFacts: { colors: ["gray"], materials: [], shape: "rounded rectangle", markings: [], packaging: "", distinctiveFeatures: ["mirror back"] }, functionalFacts: ["protects phone"], shotIndexes: [2, 4, 5], referenceAssetIds: [], representativeFrameIds: ["frame-cta"], confidence: 0.96 },
        { id: "presenter", kind: "person", name: "presenter", role: "character", visualFacts: { colors: [], materials: [], shape: "", markings: [], packaging: "", distinctiveFeatures: ["long dark hair"] }, functionalFacts: ["demonstrates product"], shotIndexes: [3, 4, 5], referenceAssetIds: [], representativeFrameIds: ["frame-cta"], confidence: 0.93 },
        { id: "warehouse", kind: "scene", name: "warehouse", role: "environment", visualFacts: { colors: ["gray"], materials: ["concrete"], shape: "industrial aisle", markings: [], packaging: "", distinctiveFeatures: ["shelving"] }, functionalFacts: [], shotIndexes: [1, 2, 3, 4, 5], referenceAssetIds: [], representativeFrameIds: ["frame-hook"], confidence: 0.9 },
        { id: "green-shirt", kind: "wardrobe", name: "green work shirt", role: "supporting-object", visualFacts: { colors: ["green"], materials: [], shape: "shirt", markings: [], packaging: "", distinctiveFeatures: [] }, functionalFacts: [], shotIndexes: [3], referenceAssetIds: [], representativeFrameIds: [], confidence: 0.85 },
        { id: "display-box", kind: "prop", name: "display box", role: "supporting-object", visualFacts: { colors: ["brown"], materials: ["cardboard"], shape: "box", markings: [], packaging: "", distinctiveFeatures: [] }, functionalFacts: ["holds product"], shotIndexes: [4], referenceAssetIds: [], representativeFrameIds: [], confidence: 0.82 },
    ],
    mustKeepEvents: [
        { id: "event-hook", priority: "P0", function: "hook", sourceStartSeconds: 0, sourceEndSeconds: 0.7, parentShotIndex: 1, description: "truck doors burst open", startState: "truck closed", endState: "doors open", involvedObjectIds: ["truck"], audioCue: "door impact", evidenceIds: ["frame-hook", "audio-impact"] },
        { id: "event-avalanche", priority: "P0", function: "spectacle", sourceStartSeconds: 0.7, sourceEndSeconds: 5.2, parentShotIndex: 1, description: "products avalanche out", startState: "products inside", endState: "products cover floor", involvedObjectIds: ["truck", "case"], audioCue: "falling objects", evidenceIds: ["frame-hook"] },
        { id: "event-reveal", priority: "P1", function: "reveal", sourceStartSeconds: 5.2, sourceEndSeconds: 8.1, parentShotIndex: 1, description: "presenter emerges", startState: "presenter hidden", endState: "presenter visible", involvedObjectIds: ["presenter"], audioCue: "", evidenceIds: [] },
        { id: "event-proof", priority: "P0", function: "product_proof", sourceStartSeconds: 8.1, sourceEndSeconds: 13.4, parentShotIndex: 2, description: "presenter demonstrates case", startState: "case at distance", endState: "case close-up", involvedObjectIds: ["presenter", "case"], audioCue: "voiceover", evidenceIds: ["frame-cta"] },
        { id: "event-cta", priority: "P0", function: "cta", sourceStartSeconds: 13.4, sourceEndSeconds: 15, parentShotIndex: 2, description: "presenter gives CTA", startState: "demo complete", endState: "product held to camera", involvedObjectIds: ["presenter", "case"], audioCue: "voiceover", evidenceIds: ["frame-cta"] },
    ],
};

describe("viral source recognition", () => {
    test("parses observable objects, ordered must-keep events, and audio evidence", () => {
        const result = parseViralVideoSourceRecognition(rawRecognition, 15);

        assert.deepEqual(result.objects.map((object) => object.kind), ["vehicle", "product", "person", "scene", "wardrobe", "prop"]);
        assert.deepEqual(result.mustKeepEvents.map((event) => event.function), ["hook", "spectacle", "reveal", "product_proof", "cta"]);
        assert.equal(result.mustKeepEvents.every((event) => event.sourceStartSeconds < event.sourceEndSeconds), true);
        assert.equal(result.mustKeepEvents.every((event) => event.targetStartSeconds === event.sourceStartSeconds), true);
        assert.equal(result.sourceEvidence.some((evidence) => evidence.kind === "audio"), true);
        assert.deepEqual(findViralVideoSourceRecognitionQualityIssues(result, 15), []);
    });

    test("normalizes Gemini sound evidence to the canonical audio kind", () => {
        const result = parseViralVideoSourceRecognition(
            {
                ...rawRecognition,
                sourceEvidence: rawRecognition.sourceEvidence.map((evidence) => evidence.kind === "audio" ? { ...evidence, kind: "sound" } : evidence),
            },
            15,
        );

        assert.equal(result.sourceEvidence.find((evidence) => evidence.id === "audio-impact")?.kind, "audio");
    });

    test("normalizes an unknown object kind from its canonical role", () => {
        const result = parseViralVideoSourceRecognition(
            {
                ...rawRecognition,
                objects: rawRecognition.objects.map((object) => object.role === "hero-product" ? { ...object, kind: "food" } : object),
            },
            15,
        );

        assert.equal(result.objects.find((object) => object.id === "case")?.kind, "product");
    });

    test("requires opening, ending, hero product, and P0 spectacle coverage", () => {
        const result = parseViralVideoSourceRecognition(
            {
                ...rawRecognition,
                objects: rawRecognition.objects.map((object) => object.role === "hero-product" ? { ...object, role: "supporting-object" } : object),
                mustKeepEvents: rawRecognition.mustKeepEvents.filter((event) => !["spectacle", "cta"].includes(event.function)),
            },
            15,
        );

        const issues = findViralVideoSourceRecognitionQualityIssues(result, 15);
        assert.equal(issues.some((issue) => issue.includes("核心商品")), true);
        assert.equal(issues.some((issue) => issue.includes("核心视觉爆点")), true);
        assert.equal(issues.some((issue) => issue.includes("结尾")), true);
    });

    test("does not invent a CTA when the source ending contains none", () => {
        const result = parseViralVideoSourceRecognition(
            {
                ...rawRecognition,
                mustKeepEvents: rawRecognition.mustKeepEvents
                    .filter((event) => event.function !== "cta")
                    .map((event) => event.id === "event-proof" ? { ...event, sourceEndSeconds: 15 } : event),
            },
            15,
        );

        assert.deepEqual(findViralVideoSourceRecognitionQualityIssues(result, 15), []);
    });

    test("combines coverage anchors with supplied visual-change candidates", () => {
        const times = buildViralVideoEvidenceFrameTimes(15, 12, [0.63, 7.25, 13.4]);

        assert.equal(times[0], 0);
        assert.equal(times.at(-1), 14.99);
        assert.equal(times.includes(0.63), true);
        assert.equal(times.includes(7.25), true);
        assert.equal(times.length <= 12, true);
        assert.equal(new Set(times.map((time, index) => index ? Number((time - times[index - 1]).toFixed(2)) : 0)).size > 3, true);
    });

    test("prompt requires structured evidence and forbids invented audio for frame-only analysis", () => {
        const prompt = buildViralVideoAnalysisPrompt(15, [0, 0.63, 7.25, 14.99]);

        assert.match(prompt, /mustKeepEvents/);
        assert.match(prompt, /sourceEvidence/);
        assert.match(prompt, /kind 只能是 frame、audio、subtitle、transcript/);
        assert.match(prompt, /objects/);
        assert.match(prompt, /采样帧不包含音轨/);
        assert.match(prompt, /audioEvidenceAvailable/);
    });
});
