import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";

import { addViralVideoReplacementAssets, buildViralVideoReplacementLibrary, buildViralVideoReplacementManifest, confirmViralVideoReplacementElement, listViralVideoReplacementAssets, mergeViralVideoReplacementLibrary } from "../src/lib/canvas/viral-video-replacement-library.ts";
import { buildViralVideoRemakeActivation, buildViralVideoRemakeProject } from "../src/lib/canvas/viral-video-remake-workflow.ts";

const analysis = {
    title: "街头反转",
    durationSeconds: 8,
    aspectRatio: "9:16",
    hook: "货车突然打开",
    narrativeStructure: "建立-冲击-收束",
    editRhythm: "紧凑",
    visualStyle: "纪实",
    soundStrategy: "环境音",
    transferableCore: "物体倾泻形成反转",
    replacementElements: [
        { id: "man", name: "轮椅男子", category: "人物", description: "坐在轮椅上的主要人物", shotIndexes: [1, 2] },
        { id: "foam", name: "白色泡沫容器", category: "物品", description: "被倾倒并冲洗的关键物品", shotIndexes: [2, 3] },
        { id: "road", name: "乡村道路", category: "场景", description: "全片发生的道路空间", shotIndexes: [1, 2, 3] },
    ],
    shots: [],
};

describe("viral remake replacement library", () => {
    test("creates one optional large replacement card instead of a required image node", () => {
        const project = buildViralVideoRemakeProject();
        const replacementNode = project.nodes.find((node) => node.id === project.workflow.replacementNodeId);

        assert.ok(replacementNode);
        assert.equal(replacementNode.type, "config");
        assert.ok(replacementNode.width >= 960);
        assert.ok(replacementNode.height >= 480);
        assert.deepEqual(replacementNode.metadata?.viralVideoReplacementLibrary?.elements, []);
        assert.match(replacementNode.title, /替换元素（可选）/);
    });

    test("activating around a video creates only one optional replacement library card", () => {
        const sourceVideo = {
            id: "source",
            type: "video",
            title: "source.mp4",
            position: { x: 100, y: 100 },
            width: 240,
            height: 420,
            metadata: { content: "blob:source", mimeType: "video/mp4" },
        };
        const first = buildViralVideoRemakeActivation([sourceVideo], sourceVideo.id);
        const second = buildViralVideoRemakeActivation(first.nodes, sourceVideo.id, first.workflow);

        assert.equal(second.workflow.replacementNodeId, first.workflow.replacementNodeId);
        assert.equal(second.nodes.filter((node) => node.metadata?.viralVideoReplacementLibrary).length, 1);
    });

    test("keeps multiple replacement targets and multiple reference images per target", () => {
        const library = buildViralVideoReplacementLibrary(analysis);
        const withCharacterRefs = addViralVideoReplacementAssets(library, "man", [
            { id: "front", name: "正面.png", content: "blob:front", storageKey: "image:front", mimeType: "image/png" },
            { id: "side", name: "侧面.png", content: "blob:side", storageKey: "image:side", mimeType: "image/png" },
        ]);
        const completed = addViralVideoReplacementAssets(withCharacterRefs, "road", [{ id: "scene", name: "场景.png", content: "blob:scene", storageKey: "image:scene", mimeType: "image/png" }]);

        assert.equal(completed.elements.length, 3);
        assert.equal(completed.elements.find((element) => element.id === "man")?.assets.length, 2);
        assert.equal(completed.elements.find((element) => element.id === "road")?.assets.length, 1);
        assert.equal(listViralVideoReplacementAssets(completed).length, 3);
        assert.match(buildViralVideoReplacementManifest(completed), /参考图 1–2：人物「轮椅男子」/);
        assert.match(buildViralVideoReplacementManifest(completed), /参考图 3：场景「乡村道路」/);
    });

    test("refreshes detected elements without losing user-bound assets", () => {
        const existing = addViralVideoReplacementAssets(buildViralVideoReplacementLibrary(analysis), "man", [{ id: "front", name: "正面.png", content: "blob:front", storageKey: "image:front", mimeType: "image/png" }]);
        const refreshed = mergeViralVideoReplacementLibrary(existing, {
            ...analysis,
            replacementElements: [...analysis.replacementElements, { id: "truck", name: "白色货车", category: "车辆", description: "倾倒物品的货车", shotIndexes: [1, 2] }],
        });

        assert.equal(refreshed.elements.length, 4);
        assert.equal(refreshed.elements.find((element) => element.id === "man")?.assets[0]?.storageKey, "image:front");
    });

    test("uses structured source object fingerprints as replacement targets", () => {
        const library = buildViralVideoReplacementLibrary({
            ...analysis,
            objects: [
                {
                    schemaVersion: 1,
                    id: "hero-product",
                    origin: "source-video",
                    kind: "product",
                    name: "镜面手机壳",
                    role: "hero-product",
                    visualFacts: { colors: ["灰色"], materials: [], shape: "圆角矩形", markings: [], packaging: "", distinctiveFeatures: ["镜面背板"] },
                    functionalFacts: ["保护手机"],
                    shotIndexes: [2, 3],
                    referenceAssetIds: [],
                    representativeFrameIds: ["frame-2"],
                    confidence: 0.95,
                },
            ],
        });

        assert.equal(library.elements.length, 1);
        assert.equal(library.elements[0].id, "hero-product");
        assert.equal(library.elements[0].category, "商品");
        assert.equal(library.elements[0].fingerprint?.role, "hero-product");
    });

    test("manually confirms a failed upload as the replacement for its source slot", () => {
        const library = buildViralVideoReplacementLibrary({
            ...analysis,
            objects: [
                {
                    schemaVersion: 1,
                    id: "source-character",
                    origin: "source-video",
                    kind: "person",
                    name: "拟人生牛肉生物",
                    role: "character",
                    visualFacts: { colors: ["红色"], materials: [], shape: "人形", markings: [], packaging: "", distinctiveFeatures: [] },
                    functionalFacts: ["拉出商品"],
                    shotIndexes: [1, 2, 3],
                    referenceAssetIds: [],
                    representativeFrameIds: ["frame-1"],
                    confidence: 0.91,
                },
            ],
            mustKeepEvents: [
                { id: "event-1", involvedObjectIds: ["source-character"] },
                { id: "event-2", involvedObjectIds: ["source-character"] },
            ],
        });
        const withAsset = addViralVideoReplacementAssets(library, "source-character", [
            {
                id: "robot-image",
                name: "红色机器人.png",
                content: "blob:robot",
                mimeType: "image/png",
                recognitionStatus: "needs-confirmation",
                recognitionError: "素材识别置信度不足，需要确认",
            },
        ]);

        const confirmed = confirmViralVideoReplacementElement(withAsset, "source-character", ["event-1", "event-2"]);
        const element = confirmed.elements[0];

        assert.equal(element.assets[0].recognitionStatus, "recognized");
        assert.equal(element.assets[0].recognitionError, undefined);
        assert.equal(element.replacementFingerprint?.origin, "uploaded-reference");
        assert.equal(element.replacementFingerprint?.kind, "person");
        assert.equal(element.replacementFingerprint?.role, "character");
        assert.equal(element.binding?.status, "bound");
        assert.equal(element.binding?.mode, "user-confirmed");
        assert.equal(element.binding?.replacementObjectId, element.replacementFingerprint?.id);
        assert.deepEqual(element.binding?.affectedEventIds, ["event-1", "event-2"]);
    });

    test("describes confirmed assets as explicit source-to-replacement mappings", () => {
        const library = buildViralVideoReplacementLibrary({
            ...analysis,
            objects: [
                {
                    schemaVersion: 1,
                    id: "source-character",
                    origin: "source-video",
                    kind: "person",
                    name: "拟人生牛肉生物",
                    role: "character",
                    visualFacts: { colors: [], materials: [], shape: "人形", markings: [], packaging: "", distinctiveFeatures: [] },
                    functionalFacts: [],
                    shotIndexes: [1, 2, 3],
                    referenceAssetIds: [],
                    representativeFrameIds: [],
                    confidence: 0.9,
                },
            ],
        });
        const confirmed = confirmViralVideoReplacementElement(
            addViralVideoReplacementAssets(library, "source-character", [
                { id: "robot", name: "红色机器人.png", content: "blob:robot", mimeType: "image/png", recognitionStatus: "needs-confirmation" },
            ]),
            "source-character",
            ["event-1", "event-2"],
        );

        const manifest = buildViralVideoReplacementManifest(confirmed);

        assert.match(manifest, /原片人物「拟人生牛肉生物」/);
        assert.match(manifest, /替换为「红色机器人」/);
        assert.match(manifest, /用户已确认并锁定全片 2 个事件/);
    });

    test("renders the optional library as one draggable composite card", async () => {
        const component = await readFile(path.join(process.cwd(), "src/components/canvas/viral-video-replacement-library-node-content.tsx"), "utf8");
        const project = await readFile(path.join(process.cwd(), "src/pages/canvas/project.tsx"), "utf8");

        assert.match(component, /复刻素材与对象识别（可选）/);
        assert.match(component, /不上传任何素材也可以直接生成/);
        assert.match(component, /library\.elements\.map/);
        assert.match(component, /element\.assets\.map/);
        assert.match(component, /cursor-grab/);
        assert.match(component, /className="flex h-full w-full min-h-0 flex-col/);
        assert.match(component, /确认用于替换/);
        assert.match(component, /onConfirmElement/);
        assert.match(project, /multiple = true/);
        assert.match(project, /viralVideoReplacementLibrary/);
        assert.match(project, /replacementImages/);
    });
});
