import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
    bindViralVideoReplacementObjects,
    findViralVideoBindingIssues,
} from "../src/lib/canvas/viral-video-object-binding.ts";

const fingerprint = (id, kind, role, name = id) => ({
    schemaVersion: 1,
    id,
    origin: id.startsWith("upload") ? "uploaded-reference" : "source-video",
    kind,
    name,
    role,
    visualFacts: { colors: [], materials: [], shape: "", markings: [], packaging: "", distinctiveFeatures: [] },
    functionalFacts: [],
    shotIndexes: [],
    referenceAssetIds: [],
    representativeFrameIds: [],
    confidence: 0.9,
});

const events = [
    { id: "event-1", involvedObjectIds: ["source-product", "source-person"] },
    { id: "event-2", involvedObjectIds: ["source-product"] },
];

describe("viral replacement object binding", () => {
    test("explicit binding wins over inferred matches", () => {
        const source = [fingerprint("source-product", "product", "hero-product")];
        const replacements = [
            fingerprint("upload-product-a", "product", "hero-product"),
            fingerprint("upload-product-b", "product", "hero-product"),
        ];
        const result = bindViralVideoReplacementObjects(source, replacements, events, [
            { sourceObjectId: "source-product", replacementObjectId: "upload-product-b" },
        ]);

        assert.equal(result[0].replacementObjectId, "upload-product-b");
        assert.equal(result[0].mode, "user-confirmed");
        assert.equal(result[0].status, "bound");
    });

    test("single hero product is auto-bound", () => {
        const result = bindViralVideoReplacementObjects(
            [fingerprint("source-product", "product", "hero-product")],
            [fingerprint("upload-product", "product", "hero-product")],
            events,
        );

        assert.equal(result[0].replacementObjectId, "upload-product");
        assert.equal(result[0].status, "bound");
        assert.equal(result[0].mode, "auto");
    });

    test("ambiguous character uploads require confirmation", () => {
        const result = bindViralVideoReplacementObjects(
            [fingerprint("source-person", "person", "character")],
            [fingerprint("upload-person-a", "person", "character"), fingerprint("upload-person-b", "person", "character")],
            events,
        );

        assert.equal(result[0].status, "needs-confirmation");
        assert.equal(findViralVideoBindingIssues(result).length, 1);
    });

    test("binding lists every source event where the object appears", () => {
        const result = bindViralVideoReplacementObjects(
            [fingerprint("source-product", "product", "hero-product")],
            [fingerprint("upload-product", "product", "hero-product")],
            events,
        );

        assert.deepEqual(result[0].affectedEventIds, ["event-1", "event-2"]);
    });
});
