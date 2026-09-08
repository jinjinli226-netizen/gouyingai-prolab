import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readFile } from "node:fs/promises";

import { buildUniversalRemakeBetaProject } from "../src/lib/universal-viral-remake/canvas-adapter.ts";

describe("universal remake beta canvas contract", () => {
    test("creates one isolated five-card workflow in execution order", () => {
        const project = buildUniversalRemakeBetaProject(() => `id-${Math.random()}`);
        const roles = project.nodes.map((node) => node.metadata?.universalRemakeCard?.role);
        assert.deepEqual(roles, ["reference", "bindings", "template", "run", "results"]);
        assert.equal(project.connections.length, 4);
        assert.equal(project.workflow.kind, "universal-viral-remake-beta");
        assert.equal(project.workflow.candidateCount, 1);
        assert.equal(project.workflow.maxSegmentDurationSeconds, 15);
    });

    test("keeps the old workflow implementation isolated from the new module", async () => {
        const files = ["canvas-adapter.ts", "engine.ts", "reconstruction.ts", "verification.ts", "prompt-compiler.ts"];
        for (const file of files) {
            const source = await readFile(new URL(`../src/lib/universal-viral-remake/${file}`, import.meta.url), "utf8");
            assert.doesNotMatch(source, /viral-video-remake-workflow|viral-video-domain|viral-video-template/);
        }
    });

    test("labels the new entry as beta without renaming the existing product", async () => {
        const toolbar = await readFile(new URL("../src/components/canvas/canvas-toolbar.tsx", import.meta.url), "utf8");
        assert.match(toolbar, /爆款复刻/);
        assert.match(toolbar, /通用复刻 Beta/);
    });

    test("shows the dimensions discovered from this video instead of promising a fixed action checklist", async () => {
        const analysis = await readFile(new URL("../src/components/canvas/universal-remake-analysis-content.tsx", import.meta.url), "utf8");
        const template = await readFile(new URL("../src/components/canvas/universal-remake-template-content.tsx", import.meta.url), "utf8");

        assert.match(analysis, /structuralInvariants/);
        assert.match(analysis, /unit\.structuralInvariants\s*\?\?\s*\[\]/);
        assert.match(analysis, /UNIVERSAL_REMAKE_SCHEMA_VERSION/);
        assert.match(analysis, /旧版拉片结果/);
        assert.match(analysis, /本片自动识别的结构维度/);
        assert.match(template, /结构不变量/);
        assert.doesNotMatch(template, /时间线、动作、镜头和连续性/);
    });

    test("shows capability coverage, concrete event facts, instance counts, and the compiled prompt", async () => {
        const analysis = await readFile(new URL("../src/components/canvas/universal-remake-analysis-content.tsx", import.meta.url), "utf8");
        const template = await readFile(new URL("../src/components/canvas/universal-remake-template-content.tsx", import.meta.url), "utf8");

        assert.match(analysis, /capabilityCoverage/);
        assert.match(analysis, /eventFacts/);
        assert.match(analysis, /physicalInstanceCount/);
        assert.match(analysis, /通用检查覆盖/);
        assert.match(analysis, /关键事件事实/);
        assert.match(template, /compiledPromptPreview/);
        assert.match(template, /完整反推生成提示词/);
    });

    test("routes storyboard and replacement-image understanding through the multimodal text binding", async () => {
        const source = await readFile(new URL("../src/pages/canvas/project.tsx", import.meta.url), "utf8");
        const analysisSection = source.split("const analyzeUniversalRemake = async () => {")[1]?.split("const addUniversalReplacementFiles = async")[0] || "";
        const replacementSection = source.split("const addUniversalReplacementFiles = async")[1]?.split("const bindUniversalReplacement =")[0] || "";

        assert.match(analysisSection, /selectNativeViralVideoAnalysisModel\(effectiveConfig\)/);
        assert.match(analysisSection, /textModel:\s*understandingModel/);
        assert.match(analysisSection, /supportsNativeViralVideoInput\(textConfig\)/);
        assert.match(analysisSection, /mediaToDataUrl/);
        assert.match(analysisSection, /type:\s*"video_url"/);
        assert.match(analysisSection, /native-video-1/);
        assert.match(analysisSection, /storyboard\.dataUrl/);
        assert.match(analysisSection, /uploadCanvasArtifact\(projectId,\s*storyboardFile/);
        assert.match(analysisSection, /artifactId:\s*storyboardArtifact\.uri/);
        assert.match(analysisSection, /buildUniversalSourceAnchorTimes\(reconstruction/);
        assert.match(analysisSection, /captureVideoFrame\(videoUrl,\s*time\)/);
        assert.match(analysisSection, /sourceReferenceAssetIds:\s*\[storyboardArtifact\.uri,\s*\.\.\.sourceAnchorArtifactIds\]/);
        assert.match(analysisSection, /sourceVideoArtifactId/);
        assert.match(replacementSection, /selectNativeViralVideoAnalysisModel\(effectiveConfig\)/);
        assert.match(replacementSection, /textModel:\s*understandingModel/);
    });

    test("adds persisted source visual anchors only when compiling an exact source-only remake", async () => {
        const project = await readFile(new URL("../src/pages/canvas/project.tsx", import.meta.url), "utf8");
        const compileSection = project.split("const compileUniversalTemplate = async () => {")[1]?.split("const updateUniversalSettings =")[0] || "";

        assert.match(compileSection, /withUniversalSourceVisualAnchors/);
        assert.match(compileSection, /workflow\.sourceReferenceAssetIds/);
    });

    test("explains replacement mapping, previews uploads, and lets an explicit user mapping override AI kind classification", async () => {
        const component = await readFile(new URL("../src/components/canvas/universal-remake-bindings-content.tsx", import.meta.url), "utf8");
        const project = await readFile(new URL("../src/pages/canvas/project.tsx", import.meta.url), "utf8");
        const replacementSection = project.split("const addUniversalReplacementFiles = async")[1]?.split("const compileUniversalTemplate =")[0] || "";

        assert.match(component, /第 1 步/);
        assert.match(component, /第 2 步/);
        assert.match(component, /assets\.find/);
        assert.match(component, /resolveImageUrl/);
        assert.doesNotMatch(component, /filter\(\(entity\) => entity\.kind === replacement\.kind\)/);
        assert.match(replacementSection, /identityFacts 必须使用简体中文/);
        assert.match(replacementSection, /storageKey:\s*item\.image\.storageKey/);
        assert.match(replacementSection, /kind:\s*sourceEntity\.kind/);
    });

    test("opens a real file picker from every detected source object and auto-binds uploaded variants", async () => {
        const component = await readFile(new URL("../src/components/canvas/universal-remake-bindings-content.tsx", import.meta.url), "utf8");
        const project = await readFile(new URL("../src/pages/canvas/project.tsx", import.meta.url), "utf8");
        const uploadSection = project.split("const addUniversalReplacementFiles = async")[1]?.split("const bindUniversalReplacement =")[0] || "";
        const renderSection = project.split('if (universalRole === "bindings")')[1]?.split('if (universalRole === "template")')[0] || "";

        assert.match(component, /useRef<HTMLInputElement>/);
        assert.match(component, /inputRef\.current\?\.click\(\)/);
        assert.match(component, /openFilePicker\(entity\.id\)/);
        assert.doesNotMatch(component, /<label>/);
        assert.match(component, /onFiles\(files, pendingSourceEntityIdRef\.current\)/);
        assert.match(uploadSection, /preferredSourceEntityId\?:\s*string/);
        assert.match(uploadSection, /sourceEntityId:\s*preferredSourceEntity\.id/);
        assert.match(renderSection, /addUniversalReplacementFiles\(files, sourceEntityId\)/);
    });

    test("keeps replacement target selection clicks out of the draggable canvas node", async () => {
        const component = await readFile(new URL("../src/components/canvas/universal-remake-bindings-content.tsx", import.meta.url), "utf8");

        assert.match(component, /popupRender=\{\(menu\)\s*=>/);
        assert.match(component, /onMouseDown=\{\(event\)\s*=>\s*event\.stopPropagation\(\)\}/);
        assert.match(component, /onPointerDown=\{\(event\)\s*=>\s*event\.stopPropagation\(\)\}/);
        assert.match(component, /onChange=\{\(sourceId\)\s*=>\s*onBind\(replacement\.id,\s*sourceId\)\}/);
    });

    test("resolves the universal batch auto model from actual segment duration and reference count before binding", async () => {
        const project = await readFile(new URL("../src/pages/canvas/project.tsx", import.meta.url), "utf8");
        const submitSection = project.split("const generateUniversalRemake = async () => {")[1]?.split("const generateViralVideoPrompts = async")[0] || "";

        assert.match(submitSection, /resolveAutoDlH3CanvasVideoConfig/);
        assert.match(submitSection, /Math\.ceil\(maxSegmentDurationSeconds\)/);
        assert.match(submitSection, /imageCount:\s*maxReferenceImages/);
        assert.match(submitSection, /const routedModelName = modelOptionName\(routed\.model\)/);
        assert.match(submitSection, /resolveCanvasJobModelBinding\(routedModelName,\s*"video"\)/);
        assert.match(submitSection, /modelId:\s*routedModelName/);
        assert.doesNotMatch(submitSection, /resolveCanvasJobModelBinding\(routed\.model/);
    });

    test("compiles a one-shot director prompt before any paid universal generation", async () => {
        const project = await readFile(new URL("../src/pages/canvas/project.tsx", import.meta.url), "utf8");
        const analysis = await readFile(new URL("../src/components/canvas/universal-remake-analysis-content.tsx", import.meta.url), "utf8");
        const compileSection = project.split("const compileUniversalTemplate = async () => {")[1]?.split("const updateUniversalSettings =")[0] || "";
        const submitSection = project.split("const generateUniversalRemake = async () => {")[1]?.split("const generateViralVideoPrompts = async")[0] || "";

        assert.match(project, /createUniversalDirectorPromptRequest/);
        assert.match(project, /createUniversalDirectorPromptRepairRequest/);
        assert.match(project, /parseUniversalDirectorPromptPlan/);
        assert.match(compileSection, /requestImageQuestion/);
        assert.match(compileSection, /while \(!directorPromptPlan\)/);
        assert.match(compileSection, /catch \(validationError\)/);
        assert.match(compileSection, /createUniversalDirectorPromptRepairRequest/);
        assert.match(compileSection, /phase:\s*"analyzed"/);
        assert.match(compileSection, /patchUniversalWorkflow\(\{\s*phase:\s*"analyzed",\s*error:\s*undefined\s*\}\)/);
        assert.match(compileSection, /directorPromptPlan/);
        assert.match(compileSection, /compiledPromptPreview/);
        assert.match(analysis, /onContinue/);
        assert.match(analysis, /继续生成母版/);
        assert.match(analysis, /loading=\{busy\}/);
        assert.match(project, /onContinue=\{\(\) => void compileUniversalTemplate\(\)\}/);
        assert.match(submitSection, /directorPromptPlan/);
        assert.match(submitSection, /重新生成复刻母版/);
    });

    test("keeps self-healing backstage instead of exposing an internal reconstruction dead end", async () => {
        const analysis = await readFile(new URL("../src/components/canvas/universal-remake-analysis-content.tsx", import.meta.url), "utf8");
        const project = await readFile(new URL("../src/pages/canvas/project.tsx", import.meta.url), "utf8");

        assert.match(analysis, /正在分析并自动修复/);
        assert.doesNotMatch(analysis, /\{error\}/);
        assert.match(analysis, /拉片暂时没有完成/);
        assert.match(project, /stalledUniversalValidationRetryRef/);
        assert.match(project, /原片重建自动修复后仍不合格/);
        assert.match(project, /void analyzeUniversalRemake\(\)/);
    });

    test("adopts the newest run for the same canvas even when the tracked run already completed", async () => {
        const project = await readFile(new URL("../src/pages/canvas/project.tsx", import.meta.url), "utf8");
        const refreshSection = project.split('if (workflow?.kind !== "universal-viral-remake-beta"').at(-1)?.split("if (!projectLoaded")[0] || "";

        assert.match(project, /listUniversalRemakeRuns/);
        assert.match(refreshSection, /listUniversalRemakeRuns\(projectId\)/);
        assert.match(refreshSection, /latestRun\.updated_at > run\.updated_at/);
        assert.match(refreshSection, /activeRunId:\s*latestRun\.id/);
        assert.doesNotMatch(refreshSection, /if \(run\.status === "failed" \|\| run\.status === "cancelled"\)/);
    });

    test("does not present provider completion as a fidelity-passed remake", async () => {
        const api = await readFile(new URL("../src/services/api/universal-remake-runs.ts", import.meta.url), "utf8");
        const results = await readFile(new URL("../src/components/canvas/universal-remake-results-content.tsx", import.meta.url), "utf8");

        assert.match(api, /fidelity_status/);
        assert.match(api, /not-evaluated/);
        assert.match(results, /生成完成，复刻待校验/);
        assert.match(results, /生成完成，复刻未通过/);
        assert.match(results, /fidelity_issues/);
    });

    test("submits a native-video fidelity contract and exposes a bounded retry policy", async () => {
        const project = await readFile(new URL("../src/pages/canvas/project.tsx", import.meta.url), "utf8");
        const run = await readFile(new URL("../src/components/canvas/universal-remake-run-content.tsx", import.meta.url), "utf8");
        const results = await readFile(new URL("../src/components/canvas/universal-remake-results-content.tsx", import.meta.url), "utf8");
        const submitSection = project.split("const generateUniversalRemake = async () => {")[1]?.split("const generateViralVideoPrompts = async")[0] || "";

        assert.match(submitSection, /selectNativeViralVideoAnalysisModel/);
        assert.match(submitSection, /resolveCanvasJobModelBinding\([^,]+,\s*"text"\)/);
        assert.match(submitSection, /sourceVideoArtifactId/);
        assert.match(submitSection, /fidelityContract/);
        assert.match(submitSection, /fidelityThreshold/);
        assert.match(submitSection, /maxFidelityRetries/);
        assert.match(run, /自动纠错重试上限/);
        assert.match(run, /最坏情况/);
        assert.match(results, /fidelity-failed/);
        assert.match(results, /fidelity_score/);
    });
});
