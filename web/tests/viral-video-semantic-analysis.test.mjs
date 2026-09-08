import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";

import * as workflow from "../src/lib/canvas/viral-video-remake-workflow.ts";

const { buildViralVideoAnalysisPrompt } = workflow;

function makeShot(overrides = {}) {
    return {
        index: 1,
        parentShotIndex: 1,
        startSeconds: 0,
        endSeconds: 5,
        durationSeconds: 5,
        boundaryType: "first",
        boundaryReason: "视频开始",
        startState: "男子坐在轮椅上，货车在前方",
        endState: "男子仍坐在轮椅上，货车后门开始打开",
        continuityFromPrevious: "首段",
        frameDescription: "男子跟随货车前进",
        scene: "户外道路",
        characters: "男子",
        action: "男子跟随货车",
        dialogue: "",
        visibleText: "",
        narrativePurpose: "建立人物与货车关系",
        shotSize: "中景",
        composition: "人物居中",
        cameraAngle: "平视",
        lensAndFocus: "人物清晰",
        cameraMovement: "跟拍",
        lightingAndColor: "自然光",
        transition: "连续拍摄",
        musicAndSound: "",
        replaceableElements: "人物、货车",
        structuralMustKeep: "跟随关系",
        ...overrides,
    };
}

function makeAnalysis(shots) {
    return {
        title: "一镜到底实验",
        durationSeconds: shots.at(-1).endSeconds,
        aspectRatio: "9:16",
        hook: "意外倾倒",
        narrativeStructure: "建立-冲突-实验-揭示",
        editRhythm: "连续推进",
        visualStyle: "纪实",
        soundStrategy: "",
        transferableCore: "连续动作反转",
        shots,
    };
}

describe("viral video semantic beat analysis", () => {
    test("analysis prompt splits continuous takes by observable meaning instead of fixed time", () => {
        const prompt = buildViralVideoAnalysisPrompt(15.09, [0, 0.75, 1.5, 2.25, 3]);

        assert.match(prompt, /语义动作节拍/);
        assert.match(prompt, /不按固定秒数、平均间隔或采样帧数量/);
        assert.match(prompt, /同一个真实剪辑镜头.*多个.*动作节拍/s);
        for (const field of ["parentShotIndex", "boundaryType", "boundaryReason", "startState", "endState", "continuityFromPrevious"]) {
            assert.match(prompt, new RegExp(`"${field}"`), field);
        }
    });

    test("quality gate rejects one unit that collapses several ordered actions", () => {
        assert.equal(typeof workflow.findViralVideoAnalysisQualityIssues, "function");
        const analysis = makeAnalysis([
            makeShot({
                endSeconds: 15.09,
                durationSeconds: 15.09,
                action: "男子先跟随货车，随后货物倾倒，然后起身追赶，最后取水并展示残留物",
                endState: "男子向镜头展示黑色残留物",
            }),
        ]);

        assert.match(workflow.findViralVideoAnalysisQualityIssues(analysis).join("\n"), /多个依次发生的动作阶段/);
    });

    test("quality gate accepts several semantic beats inside the same continuous take", () => {
        assert.equal(typeof workflow.findViralVideoAnalysisQualityIssues, "function");
        const analysis = makeAnalysis([
            makeShot({ endSeconds: 3, durationSeconds: 3 }),
            makeShot({
                index: 2,
                startSeconds: 3,
                endSeconds: 8,
                durationSeconds: 5,
                boundaryType: "continuous_action",
                boundaryReason: "货车后门打开且泡沫开始倾倒",
                startState: "男子坐在轮椅上，货车后门刚打开",
                endState: "道路被泡沫覆盖，男子开始从轮椅起身",
                continuityFromPrevious: "延续同一道路、人物朝向和跟拍机位，货车继续前进",
                action: "泡沫从货车倾倒并覆盖道路",
            }),
            makeShot({
                index: 3,
                startSeconds: 8,
                endSeconds: 15.09,
                durationSeconds: 7.09,
                boundaryType: "continuous_action",
                boundaryReason: "男子从轮椅起身并转为追赶货车",
                startState: "道路被泡沫覆盖，男子开始从轮椅起身",
                endState: "男子拿着容器站在水槽前",
                continuityFromPrevious: "延续同一人物、服装、道路和泡沫位置，镜头继续向前跟拍",
                action: "男子起身追赶并拿起容器走向水槽",
            }),
        ]);

        assert.deepEqual(workflow.findViralVideoAnalysisQualityIssues(analysis), []);
    });

    test("quality gate allows the first beat to have no previous continuity", () => {
        const analysis = makeAnalysis([
            makeShot({ continuityFromPrevious: "" }),
        ]);

        assert.deepEqual(workflow.findViralVideoAnalysisQualityIssues(analysis), []);
    });

    test("quality gate accepts a real cut that increments the parent shot", () => {
        assert.equal(typeof workflow.findViralVideoAnalysisQualityIssues, "function");
        const analysis = makeAnalysis([
            makeShot({ endSeconds: 4, durationSeconds: 4 }),
            makeShot({
                index: 2,
                parentShotIndex: 2,
                startSeconds: 4,
                endSeconds: 9,
                durationSeconds: 5,
                boundaryType: "hard_cut",
                boundaryReason: "画面硬切到室内水槽近景",
                startState: "容器位于水龙头下方",
                endState: "容器内出现黑色残留物",
                continuityFromPrevious: "沿用上一镜头中男子手持的同一个白色容器",
                action: "男子打开水龙头冲洗容器",
                scene: "室内水槽",
            }),
        ]);

        assert.deepEqual(workflow.findViralVideoAnalysisQualityIssues(analysis), []);
    });

    test("quality gate does not double-count one stage marker repeated in frame and action descriptions", () => {
        const analysis = makeAnalysis([
            makeShot({
                endSeconds: 15.09,
                durationSeconds: 15.09,
                frameDescription: "男子随后拿起白色容器并保持站立",
                action: "男子随后拿起白色容器并保持站立",
                endState: "男子手持白色容器站立",
            }),
        ]);

        assert.deepEqual(workflow.findViralVideoAnalysisQualityIssues(analysis), []);
    });

    test("repair prompt carries the exact quality issues and first result without fixed-time splitting", () => {
        assert.equal(typeof workflow.buildViralVideoAnalysisRepairPrompt, "function");
        const firstResult = JSON.stringify(makeAnalysis([makeShot({ action: "男子先跟车，随后起身，最后展示容器" })]));
        const issues = ["镜头/动作节拍 1 包含多个依次发生的动作阶段", "镜头/动作节拍 1 缺少 endState"];
        const prompt = workflow.buildViralVideoAnalysisRepairPrompt(firstResult, issues);

        assert.match(prompt, new RegExp(issues[0]));
        assert.match(prompt, new RegExp(issues[1]));
        assert.match(prompt, /上一版完整 JSON/);
        assert.match(prompt, /男子先跟车/);
        assert.match(prompt, /基于同一批媒体证据/);
        assert.match(prompt, /不得按固定秒数|禁止按固定秒数/);
        assert.match(prompt, /只有原片确有 CTA 时才保留 CTA/);
        assert.match(prompt, /禁止凭空添加/);
    });

    test("canvas analysis performs at most one conditional semantic repair before commit", async () => {
        const source = await readFile(path.resolve("src/pages/canvas/project.tsx"), "utf8");
        const section = source.split("const analyzeViralVideo = async () => {")[1]?.split("const activateViralVideoRemake = () => {")[0] || "";

        assert.match(section, /findViralVideoAnalysisQualityIssues\(analysis\)/);
        assert.match(section, /buildViralVideoAnalysisRepairPrompt\(/);
        assert.match(section, /正在细化动作节拍/);
        assert.match(section, /if \(qualityIssues\.length\)[\s\S]*requestImageQuestion\([\s\S]*qualityIssues = findViralVideoAnalysisQualityIssues\(analysis\)[\s\S]*if \(qualityIssues\.length\) throw/);
        assert.equal((section.match(/buildViralVideoAnalysisRepairPrompt\(/g) || []).length, 1);
    });

    test("canvas sends the original video only when the selected binding declares native video input", async () => {
        const source = await readFile(path.resolve("src/pages/canvas/project.tsx"), "utf8");
        const section = source.split("const analyzeViralVideo = async () => {")[1]?.split("const activateViralVideoRemake = () => {")[0] || "";

        assert.match(section, /supportsNativeViralVideoInput\(generationConfig\)/);
        assert.match(section, /video_url:\s*\{\s*url:\s*videoDataUrl\s*\}/);
        assert.match(source, /gatewayModelCatalogEntry\(config\.model\)\?\.options\.nativeVideoInput === true/);
        assert.doesNotMatch(source, /\^gemini\(\?:-\|\$\)/);
    });

    test("canvas analysis prefers an explicitly native-video text binding over the ordinary default text model", async () => {
        const source = await readFile(path.resolve("src/pages/canvas/project.tsx"), "utf8");
        const section = source.split("const analyzeViralVideo = async () => {")[1]?.split("const activateViralVideoRemake = () => {")[0] || "";

        assert.match(section, /selectNativeViralVideoAnalysisModel\(effectiveConfig\)/);
        assert.match(source, /config\.textModels\.find\([\s\S]*nativeVideoInput === true/);
        assert.match(section, /textModel:\s*analysisModel/);
    });
});
