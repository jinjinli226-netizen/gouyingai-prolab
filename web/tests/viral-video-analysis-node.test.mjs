import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";

import {
    buildViralVideoAnalyzedWorkflowPatch,
    buildViralVideoAnalysisNode,
    VIRAL_VIDEO_ANALYSIS_NODE_SIZE,
} from "../src/lib/canvas/viral-video-analysis-node.ts";
import { buildViralVideoAnalysisShotRows } from "../src/components/canvas/viral-video-analysis-node-content.tsx";
import { formatViralVideoAnalysisSummary } from "../src/lib/canvas/viral-video-remake-workflow.ts";
import { CanvasNodeType } from "../src/types/canvas.ts";

describe("viral video analysis node contract", () => {
    const analysis = {
        title: "开场引流合集",
        durationSeconds: 14.2,
        aspectRatio: "9:16",
        hook: "钩子文案",
        narrativeStructure: "开场-亮点-收尾",
        editRhythm: "紧凑",
        visualStyle: "纪实",
        soundStrategy: "轻快 BGM",
        transferableCore: "转折递进",
        shots: [
            {
                index: 1,
                parentShotIndex: 1,
                startSeconds: 0,
                endSeconds: 6,
                durationSeconds: 6,
                boundaryType: "first",
                boundaryReason: "视频开始",
                startState: "女主站在门外",
                endState: "女主完成开门",
                continuityFromPrevious: "首段",
                frameDescription: "镜头一",
                scene: "客厅",
                characters: "A 女主",
                action: "开门",
                dialogue: "开场台词",
                visibleText: "可见字幕一",
                narrativePurpose: "引入",
                shotSize: "近景",
                composition: "对称构图",
                cameraAngle: "平视",
                lensAndFocus: "35mm 中焦",
                cameraMovement: "推镜",
                lightingAndColor: "黄昏暖色",
                transition: "剪切",
                musicAndSound: "轻鼓点",
                replaceableElements: "人物",
                structuralMustKeep: "主线稳定",
            },
            {
                index: 2,
                parentShotIndex: 1,
                startSeconds: 6,
                endSeconds: 14.2,
                durationSeconds: 8.2,
                boundaryType: "continuous_action",
                boundaryReason: "女主开门后转为穿过走廊",
                startState: "女主位于门口",
                endState: "女主到达走廊末端",
                continuityFromPrevious: "沿用同一人物、服装和连续推镜",
                frameDescription: "镜头二",
                scene: "走廊",
                characters: "B 男主",
                action: "切换",
                dialogue: "过渡语",
                visibleText: "字幕二",
                narrativePurpose: "推进",
                shotSize: "中景",
                composition: "三分法",
                cameraAngle: "俯拍",
                lensAndFocus: "50mm 长焦",
                cameraMovement: "摇镜",
                lightingAndColor: "白日光",
                transition: "淡入",
                musicAndSound: "收束音效",
                replaceableElements: "道具",
                structuralMustKeep: "动作衔接",
            },
        ],
    };

    const shotFrames = [
        {
            shotIndex: 2,
            content: "data:image/png;base64,shot2",
            storageKey: "frame-2",
            naturalWidth: 1920,
            naturalHeight: 1080,
            mimeType: "image/png",
        },
        {
            shotIndex: 1,
            content: "data:image/png;base64,shot1",
            storageKey: "frame-1",
            naturalWidth: 1080,
            naturalHeight: 1920,
            mimeType: "image/png",
        },
    ];

    test("buildViralVideoAnalysisNode keeps a single fixed-size node with full analysis metadata", () => {
        const node = buildViralVideoAnalysisNode({
            id: "analysis-node",
            title: "AI 拉片总览 · 测试",
            position: { x: 120, y: 180 },
            analysis,
            analysisPrompt: "对视频进行全量拉片",
            shotFrames,
        });

        assert.equal(node.type, CanvasNodeType.Text);
        assert.equal(node.width, VIRAL_VIDEO_ANALYSIS_NODE_SIZE.width);
        assert.equal(node.height, VIRAL_VIDEO_ANALYSIS_NODE_SIZE.height);
        assert.equal(node.metadata?.content, formatViralVideoAnalysisSummary(analysis, "对视频进行全量拉片"));
        assert.equal(node.metadata?.status, "success");
        assert.deepEqual(node.metadata?.viralVideoAnalysis, analysis);
        assert.deepEqual(node.metadata?.viralVideoShotFrames, shotFrames);
    });

    test("analysis workflow patch is analysis-node-only", () => {
        const patch = buildViralVideoAnalyzedWorkflowPatch("analysis-node-1");
        assert.deepEqual(Object.keys(patch), ["analysisNodeId"]);
        assert.equal(patch.analysisNodeId, "analysis-node-1");
    });

    test("buildViralVideoAnalysisShotRows sorts by shot index and matches representative frames by shotIndex", () => {
        const rows = buildViralVideoAnalysisShotRows(
            {
                ...analysis,
                shots: [
                    {
                        ...analysis.shots[1],
                        index: 2,
                        startSeconds: 6,
                        endSeconds: 10,
                        durationSeconds: 4,
                        scene: "",
                        characters: "",
                        dialogue: "",
                        action: "",
                        visibleText: "",
                        narrativePurpose: "",
                        shotSize: "",
                        composition: "",
                        cameraAngle: "",
                        lensAndFocus: "",
                        cameraMovement: "",
                        lightingAndColor: "",
                        transition: "",
                        musicAndSound: "",
                    },
                    {
                        ...analysis.shots[0],
                        index: 1,
                        startSeconds: Number.NaN,
                        endSeconds: Number.NEGATIVE_INFINITY,
                        durationSeconds: 0,
                        scene: "大厅",
                        characters: "主角",
                        dialogue: "",
                        action: "对话",
                        visibleText: "字幕",
                        narrativePurpose: "",
                        shotSize: "",
                        composition: "",
                        cameraAngle: "",
                        lensAndFocus: "",
                        cameraMovement: "",
                        lightingAndColor: "",
                        transition: "",
                        musicAndSound: "",
                    },
                    {
                        ...analysis.shots[0],
                        index: 3,
                        startSeconds: 10,
                        endSeconds: 14,
                        durationSeconds: 4,
                        frameDescription: "镜头三",
                        scene: "街头",
                        characters: "路人",
                        action: "转场",
                        dialogue: "结尾",
                        visibleText: "",
                        narrativePurpose: "收尾",
                        shotSize: "大全景",
                        composition: "对称",
                        cameraAngle: "仰拍",
                        lensAndFocus: "28mm 广角",
                        cameraMovement: "拉远",
                        lightingAndColor: "高对比",
                        transition: "淡入淡出",
                        musicAndSound: "结尾音效",
                    },
                ],
            },
            [
                {
                    shotIndex: 3,
                    content: "data:image/png;base64,shot3",
                    storageKey: "frame-3",
                },
                {
                    shotIndex: 1,
                    content: "data:image/png;base64,shot1b",
                    storageKey: "frame-1b",
                },
            ],
        );

        assert.deepEqual(rows.map((row) => row.shotIndex), [1, 2, 3]);
        assert.equal(rows[0].frame?.content, "data:image/png;base64,shot1b");
        assert.equal(rows[1].frame?.content, undefined);
        assert.equal(rows[2].frame?.content, "data:image/png;base64,shot3");
        assert.equal(rows[0].startLabel, "未识别");
        assert.equal(rows[0].endLabel, "未识别");
        assert.equal(rows[0].durationLabel, "0.00s");
        assert.equal(rows[0].frameDescription, "镜头一");
        assert.equal(rows[0].narrativeCharacters, "叙事：未识别");
        assert.equal(rows[0].sound, "音乐音效：未识别\n对白：字幕\n叙事功能：未识别");
        assert.equal(rows[0].parentShotIndex, 1);
        assert.equal(rows[0].boundarySummary, "视频起始");
        assert.equal(rows[1].boundarySummary, "女主开门后转为穿过走廊");
    });

    test("composite node keeps representative frames and renders compact semantic beat summaries", async () => {
        const source = await readFile(path.join(process.cwd(), "src/components/canvas/viral-video-analysis-node-content.tsx"), "utf8");
        assert.match(source, /row\.frame\?\.content/);
        assert.match(source, /object-contain/);
        assert.match(source, /动作节拍 \{row\.shotIndex\}/);
        assert.match(source, /真实镜头/);
        assert.match(source, /\{row\.startLabel\}–\{row\.endLabel\}/);
        assert.doesNotMatch(source, />\s*\{row\.boundarySummary\}\s*</);
        assert.doesNotMatch(source, /节拍边界与状态/);
        assert.doesNotMatch(source, /row\.semanticBoundary/);
        assert.doesNotMatch(source, /row\.stateContinuity/);
    });

    test("analysis card keeps a canvas drag handle while isolating its scrolling table and action button", async () => {
        const source = await readFile(path.join(process.cwd(), "src/components/canvas/viral-video-analysis-node-content.tsx"), "utf8");
        const rootTag = source.match(/return \(\s*<div[\s\S]*?>/)?.[0] || "";

        assert.ok(rootTag, "analysis renderer should have a root element");
        assert.doesNotMatch(rootTag, /onMouseDown=/, "root must let CanvasNode receive the drag start");
        assert.doesNotMatch(rootTag, /onPointerDown=/, "root must not block the entire card");
        assert.match(source, /<header className="[^"]*cursor-grab[^"]*"/);
        assert.match(source, /thin-scrollbar h-full min-h-0 flex-1 overflow-x-auto overflow-y-auto[^>]*onMouseDown=\{preventCanvasEvent\}[^>]*onPointerDown=\{preventCanvasEvent\}/);
        assert.match(source, /<button[\s\S]*?onMouseDown=\{preventCanvasEvent\}[\s\S]*?onPointerDown=\{preventCanvasEvent\}/);
    });

    test("persisted representative frames replace stale blob URLs from image storage", async () => {
        const analysisNodeModule = await import("../src/lib/canvas/viral-video-analysis-node.ts");
        assert.equal(typeof analysisNodeModule.hydrateViralVideoShotFrames, "function");

        const hydrated = await analysisNodeModule.hydrateViralVideoShotFrames(
            [
                { shotIndex: 1, content: "blob:stale-frame", storageKey: "image:frame-1" },
                { shotIndex: 2, content: "data:image/png;base64,inline" },
                { shotIndex: 3, content: "blob:missing-frame", storageKey: "image:missing" },
            ],
            async (storageKey) => (storageKey === "image:frame-1" ? "blob:restored-frame" : ""),
        );

        assert.equal(hydrated[0].content, "blob:restored-frame");
        assert.equal(hydrated[1].content, "data:image/png;base64,inline");
        assert.equal(hydrated[2].content, undefined);
    });
});

describe("viral analysis integration points", () => {
    test("project and canvas node files block inline edit for analysis nodes and render composite analysis content", async () => {
        const projectSource = await readFile(path.join(process.cwd(), "src/pages/canvas/project.tsx"), "utf8");
        const canvasNodeSource = await readFile(path.join(process.cwd(), "src/components/canvas/canvas-node.tsx"), "utf8");

        assert.match(projectSource, /if \(node\.type !== CanvasNodeType\.Text\) return;\s*if \(node\.metadata\?\.viralVideoAnalysis\) return;/);
        assert.match(projectSource, /if \(contentNode\.metadata\?\.viralVideoAnalysis\)/);
        assert.match(projectSource, /<ViralVideoAnalysisNodeContent/);
        assert.match(projectSource, /hydrateViralVideoShotFrames\(node\.metadata\.viralVideoShotFrames/);
        assert.match(canvasNodeSource, /Boolean\(data\.metadata\?\.viralVideoAnalysis\).*viralVideoPromptRole === "template"/);
        assert.match(canvasNodeSource, /props\.node\.metadata\?\.viralVideoAnalysis\s*\|\|\s*props\.node\.metadata\?\.viralVideoPromptRole === "template"/s);
    });

    test("analysis stage now produces only one composite text node and no per-shot image/text nodes", async () => {
        const projectSource = await readFile(path.join(process.cwd(), "src/pages/canvas/project.tsx"), "utf8");
        const analyzeSection = projectSource.split("const analyzeViralVideo = async () => {")[1];
        assert.ok(analyzeSection, "must include analyzeViralVideo implementation");

        assert.match(analyzeSection, /const shotFrames: ViralVideoShotFrame\[\] = \[\];/);
        assert.match(analyzeSection, /mergeViralVideoReplacementLibrary\(currentLibrary, analysis\)/);
        assert.match(analyzeSection, /replacementNodeId/);
        assert.match(analyzeSection, /viralVideoAnalysis: analysis/);
        assert.match(analyzeSection, /viralVideoShotFrames: shotFrames/);
        assert.match(analyzeSection, /fromNodeId: sourceNode\.id, toNodeId: workflow\.replacementNodeId/);
        assert.match(analyzeSection, /shotFrames\.push\(\{\s*shotIndex,/);
        assert.match(analyzeSection, /if \(!isViralAnalysisRunCurrent\(run\)\) return;[\s\S]*?const shotFrames: ViralVideoShotFrame\[\] = \[\];[\s\S]*?const frame = await uploadImage\(frameBlob\);/);
        assert.doesNotMatch(analyzeSection, /fromNodeId: sourceNode\.id, toNodeId: shotNode\.id/);
        assert.doesNotMatch(projectSource, /analysisShotNodeIds/);
    });
});

describe("viral video planning should depend only on composite analysis node", () => {
    test("prompt generation creates one composite scheme node instead of shot and segment nodes", async () => {
        const projectSource = await readFile(path.join(process.cwd(), "src/pages/canvas/project.tsx"), "utf8");
        const promptSection = projectSource.split("const generateViralVideoPrompts = async () => {")[1];
        assert.ok(promptSection, "must include generateViralVideoPrompts implementation");

        assert.match(promptSection, /const analysisNode = nodesRef\.current\.find\(\(node\) => node\.id === workflow\.analysisNodeId\);\s*const storedAnalysis = analysisNode\?\.metadata\?\.viralVideoAnalysis;/);
        assert.match(promptSection, /if \(!workflow\.analysisNodeId \|\| !analysisNode \|\| !storedAnalysis\) \{\s*message\.warning\("请先完成拉片分析，再生成复刻方案"\);\s*return;\s*\}/);
        assert.match(promptSection, /const templateNode = buildViralVideoTemplateNode\(\{/);
        assert.match(promptSection, /promptNodes\.push\(templateNode\)/);
        assert.match(promptSection, /fromNodeId: analysisNode\.id, toNodeId: templateNode\.id/);
        assert.doesNotMatch(promptSection, /const shotNodes =/);
        assert.doesNotMatch(promptSection, /const segmentNodes =/);
        assert.doesNotMatch(promptSection, /const masterNode:/);
        assert.doesNotMatch(promptSection, /const recordNode:/);
        assert.doesNotMatch(promptSection, /analysisShotNodeIds/);
    });

    test("active plans and custom rendering read the single master template", async () => {
        const projectSource = await readFile(path.join(process.cwd(), "src/pages/canvas/project.tsx"), "utf8");
        const collectSection = projectSource.split("function collectActiveViralVideoPlans")[1];
        assert.ok(collectSection);
        assert.match(collectSection, /viralVideoPromptRole !== "template"/);
        assert.match(projectSource, /<ViralVideoTemplateNodeContent/);
        assert.match(projectSource, /contentNode\.metadata\?\.viralVideoPromptRole === "template"/);
    });
});
