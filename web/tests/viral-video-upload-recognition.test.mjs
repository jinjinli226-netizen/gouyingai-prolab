import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";

import {
    applyViralVideoUploadRecognition,
    buildViralVideoUploadRecognitionPrompt,
    markViralVideoUploadRecognitionFailed,
    parseViralVideoUploadRecognition,
} from "../src/lib/canvas/viral-video-upload-recognition.ts";

const assets = [
    { id: "front", name: "front.png", content: "blob:front", storageKey: "image:front", mimeType: "image/png" },
    { id: "side", name: "side.png", content: "blob:side", storageKey: "image:side", mimeType: "image/png" },
];

const recognizedJson = JSON.stringify({
    sameObject: true,
    kind: "product",
    name: "卡通女孩小兔镜面手机壳",
    role: "hero-product",
    visualFacts: {
        colors: ["灰色", "白色", "粉色"],
        materials: [],
        shape: "圆角矩形手机壳",
        markings: ["卡通女孩", "白兔", "花朵"],
        packaging: "",
        distinctiveFeatures: ["镜面背板", "三摄开孔"],
    },
    functionalFacts: ["保护手机", "镜面补妆"],
    viewpoints: [
        { referenceIndex: 1, viewpoint: "正面" },
        { referenceIndex: 2, viewpoint: "侧面" },
    ],
    confidence: 0.96,
});

describe("uploaded replacement recognition", () => {
    test("recognizes an uploaded product from visible facts without a description", () => {
        const result = parseViralVideoUploadRecognition(recognizedJson, assets, "upload-product");

        assert.equal(result.status, "recognized");
        assert.equal(result.fingerprint.kind, "product");
        assert.equal(result.fingerprint.name, "卡通女孩小兔镜面手机壳");
        assert.equal(result.fingerprint.origin, "uploaded-reference");
        assert.deepEqual(result.fingerprint.referenceAssetIds, ["front", "side"]);
        assert.deepEqual(result.viewpoints.map((item) => item.viewpoint), ["正面", "侧面"]);
    });

    test("merges multiple angles into one fingerprint instead of variants", () => {
        const result = parseViralVideoUploadRecognition(recognizedJson, assets, "upload-product");
        const applied = applyViralVideoUploadRecognition(assets, result);

        assert.equal(applied.length, 2);
        assert.equal(applied.every((asset) => asset.recognitionStatus === "recognized"), true);
        assert.equal(applied.every((asset) => asset.fingerprint.id === "upload-product"), true);
        assert.deepEqual(applied[0].fingerprint.referenceAssetIds, ["front", "side"]);
    });

    test("marks ambiguous multi-object uploads for confirmation", () => {
        const result = parseViralVideoUploadRecognition(
            JSON.stringify({ ...JSON.parse(recognizedJson), sameObject: false, confidence: 0.61 }),
            assets,
            "upload-product",
        );

        assert.equal(result.status, "needs-confirmation");
        assert.equal(result.issues.some((issue) => issue.includes("同一对象")), true);
    });

    test("keeps uploaded assets when recognition fails", () => {
        const failed = markViralVideoUploadRecognitionFailed(assets, "模型未返回有效结构");

        assert.deepEqual(failed.map((asset) => asset.id), ["front", "side"]);
        assert.equal(failed.every((asset) => asset.recognitionStatus === "needs-confirmation"), true);
        assert.equal(failed.every((asset) => asset.recognitionError === "模型未返回有效结构"), true);
    });

    test("treats absent optional uploads as a no-op", () => {
        assert.equal(buildViralVideoUploadRecognitionPrompt(0), null);
    });

    test("canvas upload starts recognition and the card exposes recognition state", async () => {
        const project = await readFile(path.join(process.cwd(), "src/pages/canvas/project.tsx"), "utf8");
        const component = await readFile(path.join(process.cwd(), "src/components/canvas/viral-video-replacement-library-node-content.tsx"), "utf8");

        assert.match(project, /buildViralVideoUploadRecognitionPrompt/);
        assert.match(project, /parseViralVideoUploadRecognition/);
        assert.match(project, /markViralVideoUploadRecognitionFailed/);
        assert.match(component, /asset\.recognitionStatus/);
        assert.match(component, /识别中/);
        assert.match(component, /待确认/);
    });
});
