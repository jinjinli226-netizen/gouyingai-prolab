import { nanoid } from "nanoid";

import { NODE_DEFAULT_SIZE } from "@/constant/canvas";
import { CanvasNodeType, type CanvasNodeData, type ViralVideoRemakeWorkflowState } from "@/types/canvas";
import { buildViralVideoReplacementLibrary } from "./viral-video-replacement-library";
import {
    buildViralVideoEvidenceFrameTimes,
    findViralVideoSourceRecognitionQualityIssues,
    parseViralVideoSourceRecognition,
} from "./viral-video-object-recognition";
import { createViralBatchRecipe, type ViralMustKeepEvent, type ViralObjectFingerprint, type ViralSourceEvidence } from "./viral-video-domain";
import { buildViralVideoBatchNode, buildViralVideoResultsNode } from "./viral-video-results-node";
import { createViralWorkflowMachine } from "./viral-video-state-machine";
export type {
    ViralBatchRecipe,
    ViralCandidateManifest,
    ViralCoverageReport,
    ViralMustKeepEvent,
    ViralObjectFingerprint,
    ViralQualityReport,
    ViralRemakeTemplate,
    ViralReplacementBinding,
} from "./viral-video-domain";

export type ViralVideoShot = {
    index: number;
    parentShotIndex: number;
    startSeconds: number;
    endSeconds: number;
    durationSeconds: number;
    boundaryType: string;
    boundaryReason: string;
    startState: string;
    endState: string;
    continuityFromPrevious: string;
    frameDescription: string;
    scene: string;
    characters: string;
    action: string;
    dialogue: string;
    visibleText: string;
    narrativePurpose: string;
    shotSize: string;
    composition: string;
    cameraAngle: string;
    lensAndFocus: string;
    cameraMovement: string;
    lightingAndColor: string;
    transition: string;
    musicAndSound: string;
    replaceableElements: string;
    structuralMustKeep: string;
};

export type ViralVideoAnalysis = {
    title: string;
    durationSeconds: number;
    aspectRatio: string;
    hook: string;
    narrativeStructure: string;
    editRhythm: string;
    visualStyle: string;
    soundStrategy: string;
    transferableCore: string;
    objects: ViralObjectFingerprint[];
    mustKeepEvents: ViralMustKeepEvent[];
    sourceEvidence: ViralSourceEvidence[];
    audioEvidenceAvailable: boolean;
    replacementElements?: Array<{
        id: string;
        name: string;
        category: string;
        description: string;
        shotIndexes: number[];
    }>;
    shots: ViralVideoShot[];
};

export type ViralVideoPromptPlan = {
    title: string;
    originalityRules: string;
    productContinuity: string;
    elementPlan: {
        characters: string;
        product: string;
        scenes: string;
        content: string;
    };
    continuityRules: string;
    masterPrompt: string;
    shotPrompts: Array<{ index: number; prompt: string }>;
    segments: Array<{ title: string; shotIndexes: number[]; durationSeconds: number; prompt: string }>;
};

export type ViralVideoPromptPlannerInput = {
    analysis: ViralVideoAnalysis;
    replacementBrief: string;
    hasProductImage?: boolean;
    replacementAssetCount?: number;
    replacementManifest?: string;
    maxSegmentSeconds: number;
    variantIndex: number;
    totalVariants: number;
    generationSeed: number;
};

export type ViralVideoRemakePrimaryAction = "analyze" | "plan-and-generate" | "generate";

const viralVideoShotTextFields: Array<keyof Omit<ViralVideoShot, "index" | "parentShotIndex" | "startSeconds" | "endSeconds" | "durationSeconds">> = [
    "boundaryType", "boundaryReason", "startState", "endState", "continuityFromPrevious",
    "frameDescription", "scene", "characters", "action", "dialogue", "visibleText", "narrativePurpose", "shotSize", "composition",
    "cameraAngle", "lensAndFocus", "cameraMovement", "lightingAndColor", "transition", "musicAndSound", "replaceableElements", "structuralMustKeep",
];
const viralVideoTimelineToleranceSeconds = 0.1;
const viralVideoDurationToleranceSeconds = 0.5;

export function buildViralVideoAnalysisFrameTimes(durationSeconds: number, maxFrames = 24): number[] {
    return buildViralVideoEvidenceFrameTimes(durationSeconds, maxFrames);
}

export function buildViralVideoAnalysisPrompt(durationSeconds?: number, sampledFrameTimes: number[] = []): string {
    const durationHint = typeof durationSeconds === "number" && Number.isFinite(durationSeconds) && durationSeconds > 0
        ? "浏览器读取到的参考视频时长约为 " + durationSeconds + " 秒；它仅用于核对时间轴，不是预设镜头数、切点或剪辑模板。"
        : "浏览器未提供可靠时长；请完全以视频实际内容和真实剪辑为准。";
    const audioEvidenceAvailable = sampledFrameTimes.length === 0;
    const schema = {
        title: "", durationSeconds: 0, aspectRatio: "", hook: "", narrativeStructure: "", editRhythm: "", visualStyle: "", soundStrategy: "", transferableCore: "",
        audioEvidenceAvailable,
        sourceEvidence: [{ id: "frame-1", kind: "frame", startSeconds: 0, endSeconds: 0, assetId: "", description: "", confidence: 0 }],
        objects: [{ id: "object-1", kind: "product", name: "", role: "hero-product", visualFacts: { colors: [], materials: [], shape: "", markings: [], packaging: "", distinctiveFeatures: [] }, functionalFacts: [], shotIndexes: [1], referenceAssetIds: [], representativeFrameIds: ["frame-1"], confidence: 0 }],
        mustKeepEvents: [{ id: "event-1", priority: "P0", function: "hook", sourceStartSeconds: 0, sourceEndSeconds: 0, parentShotIndex: 1, description: "", startState: "", endState: "", involvedObjectIds: ["object-1"], audioCue: "", evidenceIds: ["frame-1"] }],
        replacementElements: [{ id: "element-1", name: "", category: "", description: "", shotIndexes: [1] }],
        shots: [{ index: 1, parentShotIndex: 1, startSeconds: 0, endSeconds: 0, durationSeconds: 0, boundaryType: "first", boundaryReason: "", startState: "", endState: "", continuityFromPrevious: "", frameDescription: "", scene: "", characters: "", action: "", dialogue: "", visibleText: "", narrativePurpose: "", shotSize: "", composition: "", cameraAngle: "", lensAndFocus: "", cameraMovement: "", lightingAndColor: "", transition: "", musicAndSound: "", replaceableElements: "", structuralMustKeep: "" }],
    };
    const mediaHint = sampledFrameTimes.length
        ? "本次输入是浏览器从原视频按时间顺序抽取的 " + sampledFrameTimes.length + " 张采样帧，每张图前都标有准确时间。请根据画面变化识别真实镜头并估算相邻采样点之间的切点，时间轴必须从 0 秒连续覆盖到源视频末尾，不得按采样帧机械地一帧拆成一个镜头。采样帧不包含音轨，dialogue、musicAndSound、soundStrategy 中无法从可见字幕确认的声音信息必须返回空字符串，禁止臆测。"
        : "本次输入包含原始参考视频，请同时观察完整画面与音轨。";
    return [
        "你是严谨的短视频拉片导演。请从参考视频的第一帧分析到最后一帧，先识别真实剪辑镜头，再识别每个真实镜头内部的语义动作节拍。shots 的每一项是一个可独立执行的镜头/动作节拍；同一个真实剪辑镜头可以包含多个连续动作节拍，并使用相同的 parentShotIndex。",
        durationHint,
        mediaHint,
        "语义动作节拍只能由可观察变化触发：人物目标或主动作改变、姿态或位置改变、关键物体状态或归属改变、运镜阶段改变、叙事功能改变，或可确认的对白/音效/音乐事件改变。不按固定秒数、平均间隔或采样帧数量机械切分；时长只能帮助核对时间轴，绝不能决定切点。即使整条视频一镜到底，只要依次发生多个动作或状态变化，也必须拆成多个语义动作节拍。",
        "每个节拍必须写明 boundaryType（first、continuous_action、hard_cut、transition 或 space_time_jump）、可观察的 boundaryReason、startState、endState，以及与上一节拍人物位置/朝向/动作、关键物体、场景和镜头状态的 continuityFromPrevious。硬切、转场或时空跳变才递增 parentShotIndex；镜头内连续动作变化保持相同 parentShotIndex。",
        "六维分析必须完整覆盖：1) 时间轴信息；2) 叙事要素（场景、人物、动作、可见对白/字幕）；3) 镜头语言（景别、构图、机位、镜头与运镜）；4) 影像处理（光线、色彩、转场）；5) 声音设计；6) 整体风格与可迁移核心。所有时间使用 number 类型的秒数，shots 必须严格按 startSeconds 升序排列，index 从 1 连续编号。",
        "额外输出 sourceEvidence、objects 与 mustKeepEvents。sourceEvidence 保存可核验的画面、字幕和声音证据，kind 只能是 frame、audio、subtitle、transcript；objects 为跨镜头稳定对象指纹，kind 只能是 product、person、scene、vehicle、wardrobe、animal、prop，role 只能是 hero-product、supporting-object、character、environment；mustKeepEvents 按真实时间升序保存钩子、核心视觉爆点、人物/商品揭示、商品证明，以及原片实际存在的 CTA，function 只能是 hook、spectacle、reveal、product_proof、cta、transition、context、other，priority 使用 P0/P1/P2。P0 必须覆盖开场钩子、核心反转/视觉爆点和商品证明；原片确有 CTA 时才将 CTA 设为必保事件，禁止凭空添加。",
        audioEvidenceAvailable
            ? "本次包含原始视频音轨，audioEvidenceAvailable 必须为 true；只记录确实听到的音频、口播、音乐和音效证据。"
            : "本次只有采样帧，audioEvidenceAvailable 必须为 false；sourceEvidence 不得包含 audio 或 transcript，所有无法由画面字幕确认的声音字段保持空字符串。",
        "额外输出全片 replacementElements：列出用户可能希望替换的具体人物、商品、场景、车辆、服装、动物或关键物品。不要只写抽象的“人物”“场景”，应写“轮椅男子”“白色货车”“乡村道路”这类可在画面中定位的对象；同一对象只出现一次，并列出它出现的全部 shotIndexes。",
        "只能陈述画面或声音中可观察到的事实。任何看不见或听不清的对白、字幕、品牌、人物身份或细节都不得编造：对应字符串必须返回空字符串。",
        "只返回一个严格符合 ViralVideoAnalysis 的 JSON 对象，不要 Markdown、代码围栏或任何解释。字段必须完整且名称不变：",
        JSON.stringify(schema),
    ].join("\n\n");
}

export function parseViralVideoAnalysis(content: string, sourceDurationSeconds?: number): ViralVideoAnalysis {
    const reliableSourceDuration = typeof sourceDurationSeconds === "number" && Number.isFinite(sourceDurationSeconds) && sourceDurationSeconds > 0 ? sourceDurationSeconds : undefined;
    const record = parseViralVideoRecord(content, "AI 拉片结果");
    const durationSeconds = viralVideoNumber(record.durationSeconds, "durationSeconds");
    const recognition = parseViralVideoSourceRecognition(record, durationSeconds);
    const analysis: ViralVideoAnalysis = {
        title: viralVideoString(record.title, "title"),
        durationSeconds,
        aspectRatio: viralVideoString(record.aspectRatio, "aspectRatio"),
        hook: viralVideoString(record.hook, "hook"),
        narrativeStructure: viralVideoString(record.narrativeStructure, "narrativeStructure"),
        editRhythm: viralVideoString(record.editRhythm, "editRhythm"),
        visualStyle: viralVideoString(record.visualStyle, "visualStyle"),
        soundStrategy: viralVideoString(record.soundStrategy, "soundStrategy"),
        transferableCore: viralVideoString(record.transferableCore, "transferableCore"),
        ...recognition,
        replacementElements: parseViralVideoReplacementElements(record.replacementElements),
        shots: parseViralVideoShots(record.shots),
    };
    if (analysis.durationSeconds <= 0) throw new Error("拉片 durationSeconds 必须大于 0");
    const finalShot = analysis.shots[analysis.shots.length - 1];
    if (Math.abs(analysis.durationSeconds - finalShot.endSeconds) > viralVideoDurationToleranceSeconds) {
        throw new Error("拉片 durationSeconds 与末镜头结束时间不一致");
    }
    if (reliableSourceDuration !== undefined && Math.abs(analysis.durationSeconds - reliableSourceDuration) > viralVideoDurationToleranceSeconds) {
        throw new Error("拉片 durationSeconds 与源视频时长不一致");
    }
    if (reliableSourceDuration !== undefined && finalShot.endSeconds > reliableSourceDuration + viralVideoDurationToleranceSeconds) {
        throw new Error("镜头 " + finalShot.index + " 的结束时间超过源视频时长");
    }
    if (reliableSourceDuration !== undefined && reliableSourceDuration - finalShot.endSeconds > viralVideoDurationToleranceSeconds) {
        throw new Error("镜头 " + finalShot.index + " 后仍有超过 0.5 秒未分析的源视频结尾");
    }
    return analysis;
}

export function findViralVideoAnalysisQualityIssues(analysis: ViralVideoAnalysis): string[] {
    const issues: string[] = [];
    analysis.shots.forEach((shot, position) => {
        const label = "镜头/动作节拍 " + shot.index;
        const requiredSemanticFields: Array<[string, string]> = [
            ["boundaryType", shot.boundaryType],
            ["boundaryReason", shot.boundaryReason],
            ["startState", shot.startState],
            ["endState", shot.endState],
        ];
        if (position > 0) requiredSemanticFields.push(["continuityFromPrevious", shot.continuityFromPrevious]);
        requiredSemanticFields.forEach(([field, value]) => {
            if (!value?.trim()) issues.push(label + " 缺少 " + field);
        });

        const stageMarkers = shot.action.match(/(?:先(?:是|后)?|随后|然后|接着|之后|再|最后|最终|first|next|then|after(?:wards?)?|finally)/gi) || [];
        if (stageMarkers.length >= 2) issues.push(label + " 包含多个依次发生的动作阶段，需要按可观察的语义变化继续细分");

        if (position === 0) {
            if (shot.parentShotIndex !== 1) issues.push(label + " 的 parentShotIndex 必须从 1 开始");
            if (shot.boundaryType !== "first") issues.push(label + " 的 boundaryType 必须为 first");
            return;
        }

        const previous = analysis.shots[position - 1];
        if (shot.boundaryType === "continuous_action") {
            if (shot.parentShotIndex !== previous.parentShotIndex) issues.push(label + " 是连续动作变化，必须沿用上一节拍的 parentShotIndex");
            return;
        }
        if (["hard_cut", "transition", "space_time_jump"].includes(shot.boundaryType)) {
            if (shot.parentShotIndex !== previous.parentShotIndex + 1) issues.push(label + " 出现真实镜头边界时 parentShotIndex 必须递增 1");
            return;
        }
        issues.push(label + " 的 boundaryType 无效");
    });
    if (Array.isArray(analysis.objects) && Array.isArray(analysis.mustKeepEvents) && Array.isArray(analysis.sourceEvidence)) {
        issues.push(...findViralVideoSourceRecognitionQualityIssues(analysis, analysis.durationSeconds));
    }
    return Array.from(new Set(issues));
}

export function buildViralVideoAnalysisRepairPrompt(firstResult: string, qualityIssues: string[]): string {
    if (!qualityIssues.length) throw new Error("动作节拍修复至少需要一个明确质量问题");
    return [
        "上一版拉片没有通过语义动作节拍质量门禁。请基于同一批媒体证据重新输出完整 ViralVideoAnalysis JSON；保留已经确认的事实、真实剪辑边界和总时长，只修正以下问题：",
        qualityIssues.map((issue) => "- " + issue).join("\n"),
        "重新识别人物目标/主动作、姿态/位置、关键物体状态或归属、运镜阶段、叙事功能和可确认声音事件的变化。变化才形成新节拍；不得按固定秒数、平均间隔或采样帧数量切分。连续拍摄中的多个节拍沿用同一个 parentShotIndex，并写清 startState、endState 与 continuityFromPrevious。同步修复 objects、sourceEvidence 与 mustKeepEvents，确保 P0 覆盖开场、核心视觉爆点和商品证明，并忠实覆盖原片结尾；只有原片确有 CTA 时才保留 CTA，禁止凭空添加。",
        "上一版完整 JSON：\n" + firstResult,
        "只返回修复后的完整 JSON，不要解释、Markdown 或代码围栏。",
    ].join("\n\n");
}

export function formatViralVideoAnalysisSummary(analysis: ViralVideoAnalysis, requestPrompt: string): string {
    const timeline = analysis.shots.map((shot) => "- 镜头/动作节拍 " + shot.index + "（真实镜头 " + shot.parentShotIndex + "）：" + formatViralVideoSeconds(shot.startSeconds) + "–" + formatViralVideoSeconds(shot.endSeconds) + "，" + (shot.narrativePurpose || "未识别")).join("\n");
    return [
        "# " + (analysis.title || "视频拉片"),
        "- 时长：" + formatViralVideoSeconds(analysis.durationSeconds) + "\n- 画幅：" + (analysis.aspectRatio || "未识别") + "\n- 钩子：" + (analysis.hook || "未识别") + "\n- 叙事结构：" + (analysis.narrativeStructure || "未识别") + "\n- 剪辑节奏：" + (analysis.editRhythm || "未识别") + "\n- 整体视觉风格：" + (analysis.visualStyle || "未识别") + "\n- 声音策略：" + (analysis.soundStrategy || "未识别") + "\n- 可迁移核心：" + (analysis.transferableCore || "未识别"),
        "## 必保事件\n" + (analysis.mustKeepEvents || []).map((event) => `- ${event.priority} ${event.function}：${formatViralVideoSeconds(event.sourceStartSeconds)}–${formatViralVideoSeconds(event.sourceEndSeconds)}，${event.description}`).join("\n"),
        "## 镜头/动作节拍时间轴\n" + timeline,
        "## 完整 AI 拉片提示词\n" + requestPrompt,
    ].join("\n\n");
}

export function formatViralVideoShotAnalysis(shot: ViralVideoShot): string {
    return [
        "## 镜头/动作节拍 " + shot.index + "｜真实镜头 " + shot.parentShotIndex + "｜" + formatViralVideoSeconds(shot.startSeconds) + "–" + formatViralVideoSeconds(shot.endSeconds) + "（" + formatViralVideoSeconds(shot.durationSeconds) + "）",
        "### 节拍边界与连续性\n边界类型：" + (shot.boundaryType || "未识别") + "\n边界原因：" + (shot.boundaryReason || "未识别") + "\n开始状态：" + (shot.startState || "未识别") + "\n结束状态：" + (shot.endState || "未识别") + "\n承接上一节拍：" + (shot.continuityFromPrevious || "首段/未识别"),
        "### 画面与叙事\n画面：" + (shot.frameDescription || "未识别") + "\n场景：" + (shot.scene || "未识别") + "\n人物：" + (shot.characters || "未识别") + "\n动作：" + (shot.action || "未识别") + "\n对白：" + (shot.dialogue || "无/未识别") + "\n可见文字：" + (shot.visibleText || "无/未识别") + "\n叙事功能：" + (shot.narrativePurpose || "未识别"),
        "### 镜头语言\n景别：" + (shot.shotSize || "未识别") + "\n构图：" + (shot.composition || "未识别") + "\n机位：" + (shot.cameraAngle || "未识别") + "\n镜头与焦点：" + (shot.lensAndFocus || "未识别") + "\n运镜：" + (shot.cameraMovement || "未识别"),
        "### 影像处理\n光影与色彩：" + (shot.lightingAndColor || "未识别") + "\n转场：" + (shot.transition || "无/未识别"),
        "### 声音设计\n" + (shot.musicAndSound || "无/未识别"),
        "### 可替换元素\n" + (shot.replaceableElements || "无"),
        "### 结构保留项\n" + (shot.structuralMustKeep || "无"),
    ].join("\n\n");
}

export function buildViralVideoPromptPlannerPrompt(input: ViralVideoPromptPlannerInput): string {
    const { analysis, replacementBrief, maxSegmentSeconds, variantIndex, totalVariants, generationSeed } = input;
    if (!Number.isFinite(maxSegmentSeconds) || maxSegmentSeconds <= 0) throw new Error("分段时长上限必须大于 0");
    const replacementAssetCount = input.replacementAssetCount ?? (input.hasProductImage ? 1 : 0);
    const replacementInstruction = replacementAssetCount > 0
        ? `随消息附带 ${replacementAssetCount} 张替换参考图，可绑定商品、人物、场景或道具等任意原片元素。它们已按替换对象分组，必须严格遵守以下绑定关系，不得把不同对象的参考图混用：\n${input.replacementManifest || "参考图 1：由图片内容自动匹配原片中的可替换对象。"}\n同一对象的多张图片是同一身份或物体的多角度资料，不是多个变体。仅使用图中可见事实；人物保持身份、面孔、发型、体型和服装一致，商品与道具保持轮廓、比例、颜色、材质、包装和标识一致，场景保持空间结构、光线和关键陈设一致。`
        : "本次没有上传替换素材。直接按照原片的剧情、镜头、动作和节奏进行纯 AI 重建；所有可识别人物、品牌、logo、水印和受保护素材仍需生成新的原创视觉表达。";
    const shotTimeline = analysis.shots.map((shot) => [
        "镜头/动作节拍 " + shot.index + "｜真实镜头 " + shot.parentShotIndex + "｜时间：" + shot.startSeconds + "-" + shot.endSeconds + "s（" + shot.durationSeconds + "s）",
        "边界与状态：类型=" + shot.boundaryType + "；原因=" + shot.boundaryReason + "；开始=" + shot.startState + "；结束=" + shot.endState + "；承接上一节拍=" + shot.continuityFromPrevious,
        "画面：" + shot.frameDescription,
        "叙事：场景=" + shot.scene + "；人物=" + shot.characters + "；动作=" + shot.action + "；对白=" + shot.dialogue + "；可见文字=" + shot.visibleText + "；功能=" + shot.narrativePurpose,
        "镜头语言：景别=" + shot.shotSize + "；构图=" + shot.composition + "；机位=" + shot.cameraAngle + "；镜头与焦点=" + shot.lensAndFocus + "；运镜=" + shot.cameraMovement,
        "影像处理：光影与色彩=" + shot.lightingAndColor + "；转场=" + shot.transition,
        "声音：" + shot.musicAndSound,
        "可替换元素：" + shot.replaceableElements,
        "结构保留项：" + shot.structuralMustKeep,
    ].join("\n")).join("\n\n");
    const segmentSchema: Array<{ title: string; shotIndexes: number[]; durationSeconds: number; prompt: string }> = [];
    let pendingShots: ViralVideoShot[] = [];
    analysis.shots.forEach((shot) => {
        const firstPendingShot = pendingShots[0];
        if (firstPendingShot && shot.endSeconds - firstPendingShot.startSeconds > maxSegmentSeconds + 0.000001) {
            const lastPendingShot = pendingShots[pendingShots.length - 1];
            segmentSchema.push({ title: "", shotIndexes: pendingShots.map((item) => item.index), durationSeconds: lastPendingShot.endSeconds - firstPendingShot.startSeconds, prompt: "" });
            pendingShots = [];
        }
        pendingShots.push(shot);
    });
    if (pendingShots.length > 0) {
        const firstPendingShot = pendingShots[0];
        const lastPendingShot = pendingShots[pendingShots.length - 1];
        segmentSchema.push({ title: "", shotIndexes: pendingShots.map((item) => item.index), durationSeconds: lastPendingShot.endSeconds - firstPendingShot.startSeconds, prompt: "" });
    }
    const schema = {
        title: "", originalityRules: "", productContinuity: "",
        elementPlan: { characters: "", product: "", scenes: "", content: "" },
        continuityRules: "", masterPrompt: "",
        shotPrompts: analysis.shots.map((shot) => ({ index: shot.index, prompt: "" })),
        segments: segmentSchema,
    };
    return [
        "你是原创短视频重制导演。根据以下拉片结果，为本批次生成一份可直接交给视频模型执行的原创重制提示词方案。",
        "这是第 " + (variantIndex + 1) + "/" + totalVariants + " 个复刻方案；差异化创意种子为 " + generationSeed + "-" + (variantIndex + 1) + "。它只能引导整套方案的人物、商品、场景与内容选择，绝不能出现在画面、字幕、对白或声音中。\n改造需求：" + (replacementBrief || "在保留结构的前提下做原创重制。"),
        "必须一一保留拉片中每个镜头的时间、叙事功能、镜头语言、节奏、声音设计和转场逻辑；每个分析镜头恰好产出一条 shotPrompt。segments 只用于按原顺序组织提示词，不代表多个付费视频任务；尽量按 " + maxSegmentSeconds + " 秒组织，但绝不能在镜头中间切段。若单个镜头超过该时长，保留它的原始完整时长，最终生成阶段会把全部 segments 按比例压缩进一条成片。",
        replacementInstruction,
        "原创与权利边界：重新发明人物、面孔、场景、服装、道具、屏幕文字、音乐与声音。不得复制、提及或模仿原视频中的姓名、面孔、品牌、logo、水印、口号、IP、角色或原始对白；不要使用原片可识别画面或音频。",
        "先完成唯一一套方案级 elementPlan：characters 固定全部人物身份、外观、服装与关系；product 固定商品或替换对象；scenes 固定场景映射和空间关系；content 固定剧情、台词、字幕与植入方式。continuityRules 写出全片统一的人物、商品、服装、空间、动作和声音连续性。所有镜头必须继承同一套元素方案，禁止每个镜头重新设计人物、商品、场景或内容。",
        "masterPrompt 和每一个 segment.prompt 必须是完整、可直接提交的视频生成提示词，而不是摘要。每个 prompt 要写明原创画面、动作、镜头、节奏、声音、转场、连续性与禁止项；若有替换元素参考图，明确它是被选中替换对象的唯一视觉事实来源。每条 shotPrompts[].prompt 也必须独立可执行，写齐该镜头自身的时长、画面、动作、镜头、声音、转场、连续性与禁止项；禁止写“同上”“参考 master”或任何依赖其他提示词的引用。",
        "拉片整体信息：标题=" + analysis.title + "；总时长=" + analysis.durationSeconds + "s；画幅=" + analysis.aspectRatio + "；钩子=" + analysis.hook + "；结构=" + analysis.narrativeStructure + "；节奏=" + analysis.editRhythm + "；视觉=" + analysis.visualStyle + "；声音=" + analysis.soundStrategy + "；可迁移核心=" + analysis.transferableCore + "。\n镜头时间轴：\n" + shotTimeline,
        "只返回一个严格符合 ViralVideoPromptPlan 的 JSON 对象，不要 Markdown、代码围栏或额外解释。字段不可增加、缺失或改名。segments 的 durationSeconds 必须等于该段首镜头开始至末镜头结束的真实时长：",
        JSON.stringify(schema),
    ].join("\n\n");
}

export function parseViralVideoPromptPlan(content: string, analysis: ViralVideoAnalysis, maxSegmentSeconds: number): ViralVideoPromptPlan {
    if (!Number.isFinite(maxSegmentSeconds) || maxSegmentSeconds <= 0) throw new Error("分段时长上限必须大于 0");
    const record = parseViralVideoRecord(content, "AI 重制提示词方案");
    const expectedIndexes = analysis.shots.map((shot) => shot.index);
    return {
        title: viralVideoRequiredString(record.title, "title"),
        originalityRules: viralVideoRequiredString(record.originalityRules, "originalityRules"),
        productContinuity: viralVideoRequiredString(record.productContinuity, "productContinuity"),
        elementPlan: parseViralVideoElementPlan(record.elementPlan),
        continuityRules: viralVideoRequiredString(record.continuityRules, "continuityRules"),
        masterPrompt: viralVideoRequiredString(record.masterPrompt, "masterPrompt"),
        shotPrompts: parseViralVideoShotPrompts(record.shotPrompts, expectedIndexes),
        segments: parseViralVideoSegments(record.segments, analysis),
    };
}

export function formatViralVideoShotPrompt(shotPrompt: ViralVideoPromptPlan["shotPrompts"][number], shot?: ViralVideoShot): string {
    const timing = shot ? "｜" + formatViralVideoSeconds(shot.startSeconds) + "–" + formatViralVideoSeconds(shot.endSeconds) : "";
    return "## 镜头 " + shotPrompt.index + timing + "\n\n### 完整视频生成提示词\n" + shotPrompt.prompt;
}

export function formatViralVideoPromptPlan(plan: ViralVideoPromptPlan, plannerPrompt?: string): string {
    const segments = plan.segments.map((segment, index) => "### 分段 " + (index + 1) + "：" + segment.title + "（镜头 " + segment.shotIndexes.join("、") + "｜" + formatViralVideoSeconds(segment.durationSeconds) + "）\n" + segment.prompt).join("\n\n");
    const shots = plan.shotPrompts.map((shotPrompt) => formatViralVideoShotPrompt(shotPrompt)).join("\n\n");
    return [
        "# " + plan.title,
        "## 方案级元素替换\n人物：" + plan.elementPlan.characters + "\n商品/替换对象：" + plan.elementPlan.product + "\n场景：" + plan.elementPlan.scenes + "\n内容：" + plan.elementPlan.content,
        "## 全片连续性规则\n" + plan.continuityRules,
        "## 原创规则\n" + plan.originalityRules,
        "## 商品连续性\n" + plan.productContinuity,
        "## 完整主视频生成提示词\n" + plan.masterPrompt,
        "## 分段视频生成提示词\n" + segments,
        "## 逐镜头完整视频生成提示词\n" + shots,
        plannerPrompt ? "## 完整 AI 重制策划提示词\n" + plannerPrompt : "",
    ].filter(Boolean).join("\n\n");
}

function parseViralVideoElementPlan(value: unknown): ViralVideoPromptPlan["elementPlan"] {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("elementPlan 格式不正确");
    const record = value as Record<string, unknown>;
    return {
        characters: viralVideoRequiredString(record.characters, "elementPlan.characters"),
        product: viralVideoRequiredString(record.product, "elementPlan.product"),
        scenes: viralVideoRequiredString(record.scenes, "elementPlan.scenes"),
        content: viralVideoRequiredString(record.content, "elementPlan.content"),
    };
}

function parseViralVideoReplacementElements(value: unknown): ViralVideoAnalysis["replacementElements"] {
    if (value === undefined) return [];
    if (!Array.isArray(value)) throw new Error("AI 拉片结果的 replacementElements 格式不正确");
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    return value.map((item, index) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("可替换元素 " + (index + 1) + " 格式不正确");
        const record = item as Record<string, unknown>;
        const id = viralVideoString(record.id, "replacementElements[" + index + "].id") || `element-${index + 1}`;
        const name = viralVideoString(record.name, "replacementElements[" + index + "].name");
        if (!name) throw new Error("可替换元素 " + (index + 1) + " 缺少 name");
        if (seenIds.has(id) || seenNames.has(name)) throw new Error("可替换元素 " + (index + 1) + " 重复");
        seenIds.add(id);
        seenNames.add(name);
        if (!Array.isArray(record.shotIndexes) || record.shotIndexes.some((shotIndex) => typeof shotIndex !== "number" || !Number.isInteger(shotIndex) || shotIndex < 1)) {
            throw new Error("可替换元素 " + (index + 1) + " 的 shotIndexes 无效");
        }
        return {
            id,
            name,
            category: viralVideoString(record.category, "replacementElements[" + index + "].category"),
            description: viralVideoString(record.description, "replacementElements[" + index + "].description"),
            shotIndexes: [...new Set(record.shotIndexes as number[])],
        };
    });
}

function parseViralVideoShots(value: unknown): ViralVideoShot[] {
    if (!Array.isArray(value) || value.length === 0) throw new Error("AI 拉片结果至少需要一个镜头");
    const shots = value.map((item, position) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("镜头 " + (position + 1) + " 格式不正确");
        const record = item as Record<string, unknown>;
        const index = viralVideoNumber(record.index, "镜头 " + (position + 1) + " 的 index");
        if (!Number.isInteger(index) || index !== position + 1) throw new Error("镜头 " + (position + 1) + " 的 index 必须从 1 连续编号");
        const parentShotIndex = viralVideoNumber(record.parentShotIndex, "镜头/动作节拍 " + index + " 的 parentShotIndex");
        if (!Number.isInteger(parentShotIndex) || parentShotIndex < 1) throw new Error("镜头/动作节拍 " + index + " 的 parentShotIndex 必须是正整数");
        const startSeconds = viralVideoNumber(record.startSeconds, "镜头 " + index + " 的 startSeconds");
        const endSeconds = viralVideoNumber(record.endSeconds, "镜头 " + index + " 的 endSeconds");
        viralVideoNumber(record.durationSeconds, "镜头 " + index + " 的 durationSeconds");
        if (startSeconds < 0 || endSeconds < 0) throw new Error("镜头 " + index + " 的时间不能为负数");
        if (endSeconds <= startSeconds) throw new Error("镜头 " + index + " 的 endSeconds 必须大于 startSeconds");
        const shot = { index, parentShotIndex, startSeconds, endSeconds, durationSeconds: endSeconds - startSeconds } as ViralVideoShot;
        viralVideoShotTextFields.forEach((field) => { shot[field] = viralVideoString(record[field], "镜头 " + index + " 的 " + field); });
        return shot;
    });
    if (shots[0].startSeconds > viralVideoTimelineToleranceSeconds) {
        throw new Error("镜头 " + shots[0].index + " 未从视频开头开始分析");
    }
    for (let position = 1; position < shots.length; position += 1) {
        const previous = shots[position - 1];
        const current = shots[position];
        if (current.startSeconds < previous.startSeconds) throw new Error("镜头 " + current.index + " 的开始时间未按升序排列");
        if (current.startSeconds < previous.endSeconds - viralVideoTimelineToleranceSeconds) throw new Error("镜头 " + current.index + " 与镜头 " + previous.index + " 重叠超过 0.1 秒");
        if (current.startSeconds > previous.endSeconds + viralVideoTimelineToleranceSeconds) throw new Error("镜头 " + current.index + " 与镜头 " + previous.index + " 之间有超过 0.1 秒未覆盖空档");
    }
    return shots;
}

function parseViralVideoShotPrompts(value: unknown, expectedIndexes: number[]): ViralVideoPromptPlan["shotPrompts"] {
    if (!Array.isArray(value) || value.length !== expectedIndexes.length) throw new Error("shotPrompts 必须恰好包含 " + expectedIndexes.length + " 个镜头提示词");
    const seen = new Set<number>();
    const prompts = value.map((item, position) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("镜头提示词 " + (position + 1) + " 格式不正确");
        const record = item as Record<string, unknown>;
        const index = viralVideoNumber(record.index, "镜头提示词 " + (position + 1) + " 的 index", "AI 重制提示词方案");
        if (!Number.isInteger(index) || !expectedIndexes.includes(index) || seen.has(index)) throw new Error("镜头提示词 " + (position + 1) + " 的 index 无效或重复");
        seen.add(index);
        return { index, prompt: viralVideoShotPrompt(record.prompt, index) };
    });
    return prompts.sort((left, right) => left.index - right.index);
}

function parseViralVideoSegments(value: unknown, analysis: ViralVideoAnalysis): ViralVideoPromptPlan["segments"] {
    if (!Array.isArray(value) || value.length === 0) throw new Error("segments 至少需要一个分段");
    const shotByIndex = new Map(analysis.shots.map((shot) => [shot.index, shot]));
    const expectedIndexes = analysis.shots.map((shot) => shot.index);
    const orderedIndexes: number[] = [];
    const segments = value.map((item, position) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("分段 " + (position + 1) + " 格式不正确");
        const record = item as Record<string, unknown>;
        if (!Array.isArray(record.shotIndexes) || record.shotIndexes.length === 0) throw new Error("分段 " + (position + 1) + " 必须包含镜头索引");
        const shotIndexes = record.shotIndexes.map((index, shotPosition) => {
            const parsed = viralVideoNumber(index, "分段 " + (position + 1) + " 的第 " + (shotPosition + 1) + " 个镜头索引", "AI 重制提示词方案");
            if (!Number.isInteger(parsed) || !shotByIndex.has(parsed)) throw new Error("分段 " + (position + 1) + " 包含无效镜头 " + parsed);
            orderedIndexes.push(parsed);
            return parsed;
        });
        const durationSeconds = viralVideoNumber(record.durationSeconds, "分段 " + (position + 1) + " 的 durationSeconds", "AI 重制提示词方案");
        if (durationSeconds <= 0) throw new Error("分段 " + (position + 1) + " 的时长必须大于 0");
        const firstShot = shotByIndex.get(shotIndexes[0])!;
        const lastShot = shotByIndex.get(shotIndexes[shotIndexes.length - 1])!;
        const actualDuration = lastShot.endSeconds - firstShot.startSeconds;
        if (Math.abs(durationSeconds - actualDuration) > 0.05) throw new Error("分段 " + (position + 1) + " 的 durationSeconds 与镜头时间轴不一致");
        return {
            title: viralVideoRequiredString(record.title, "分段 " + (position + 1) + " 的 title"),
            shotIndexes,
            durationSeconds,
            prompt: viralVideoRequiredString(record.prompt, "分段 " + (position + 1) + " 的 prompt"),
        };
    });
    if (orderedIndexes.length !== expectedIndexes.length || orderedIndexes.some((index, position) => index !== expectedIndexes[position])) {
        throw new Error("segments 必须按原始顺序恰好覆盖每个镜头一次");
    }
    return segments;
}

function parseViralVideoRecord(content: string, label: string): Record<string, unknown> {
    const trimmed = content.trim().replace(/^\x60\x60\x60(?:json)?\s*/i, "").replace(/\s*\x60\x60\x60$/, "");
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error(label + "没有返回有效 JSON");
    let value: unknown;
    try {
        value = JSON.parse(trimmed.slice(start, end + 1));
    } catch {
        throw new Error(label + "返回的 JSON 无法解析");
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(label + "格式不正确");
    return value as Record<string, unknown>;
}

function viralVideoString(value: unknown, field: string): string {
    if (typeof value !== "string") throw new Error("AI 拉片结果缺少字符串字段 " + field);
    return value.trim();
}

function viralVideoRequiredString(value: unknown, field: string): string {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text) throw new Error("AI 重制提示词方案缺少非空字段 " + field);
    return text;
}

function viralVideoShotPrompt(value: unknown, index: number): string {
    const prompt = viralVideoRequiredString(value, "镜头 " + index + " 的 prompt");
    const normalized = prompt.replace(/\s+/g, " ").toLowerCase();
    if (prompt.length < 40 || /^(todo|tbd|n\/a|na|placeholder|待补充|待填写|镜头提示词|prompt)$/.test(normalized)) {
        throw new Error("镜头 " + index + " 的 prompt 过短或仍为占位文本");
    }
    return prompt;
}

function viralVideoNumber(value: unknown, field: string, label = "AI 拉片结果"): number {
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(label + "缺少有效数字字段 " + field);
    return value;
}

function formatViralVideoSeconds(seconds: number): string {
    return Number(seconds.toFixed(2)) + "s";
}

export function buildViralVideoRemakeProject() {
    const sourceVideoNodeId = nanoid();
    const replacementNodeId = nanoid();
    const batchNodeId = nanoid();
    const resultsNodeId = nanoid();
    const videoSpec = NODE_DEFAULT_SIZE[CanvasNodeType.Video];
    const nodes: CanvasNodeData[] = [
        {
            id: sourceVideoNodeId,
            type: CanvasNodeType.Video,
            title: "上传爆款参考视频",
            position: { x: 260, y: 180 },
            width: videoSpec.width,
            height: videoSpec.height,
            metadata: { content: "", status: "idle" },
        },
        buildViralVideoBatchNode(batchNodeId, { x: 1480, y: 180 }, createViralBatchRecipe({ id: `recipe-${batchNodeId}`, candidateCount: 1 })),
        buildViralVideoResultsNode(resultsNodeId, { x: 2220, y: 180 }),
        {
            id: replacementNodeId,
            type: CanvasNodeType.Config,
            title: "替换元素（可选）",
            position: { x: 260, y: 620 },
            width: 1080,
            height: 560,
            metadata: { status: "idle", viralVideoReplacementLibrary: buildViralVideoReplacementLibrary() },
        },
    ];
    const workflow: ViralVideoRemakeWorkflowState = {
        kind: "viral-video-remake",
        sourceVideoNodeId,
        replacementNodeId,
        batchNodeId,
        resultsNodeId,
        replacementBrief: "",
        candidateCount: 1,
        phase: "idle",
        machine: createViralWorkflowMachine(),
    };
    return { title: "爆款复刻", nodes, connections: [], workflow, viewport: { x: 40, y: 80, k: 0.72 } };
}

export function buildViralVideoRemakeActivation(
    nodes: CanvasNodeData[],
    sourceVideoNodeId: string,
    currentWorkflow?: ViralVideoRemakeWorkflowState,
): { nodes: CanvasNodeData[]; workflow: ViralVideoRemakeWorkflowState } {
    const sourceNode = nodes.find((node) => node.id === sourceVideoNodeId);
    if (!sourceNode || sourceNode.type !== CanvasNodeType.Video || !sourceNode.metadata?.content) {
        throw new Error("请选择已上传的视频节点");
    }
    if (currentWorkflow?.kind === "viral-video-remake" && currentWorkflow.sourceVideoNodeId === sourceVideoNodeId) {
        const replacementNode = nodes.find((node) => node.id === currentWorkflow.replacementNodeId);
        if (replacementNode) return { nodes, workflow: currentWorkflow };
    }

    const replacementNodeId = nanoid();
    const batchNodeId = nanoid();
    const resultsNodeId = nanoid();
    const replacementNode: CanvasNodeData = {
        id: replacementNodeId,
        type: CanvasNodeType.Config,
        title: "替换元素（可选）",
        position: { x: sourceNode.position.x, y: sourceNode.position.y + sourceNode.height + 80 },
        width: 1080,
        height: 560,
        metadata: { status: "idle", viralVideoReplacementLibrary: buildViralVideoReplacementLibrary() },
    };
    return {
        nodes: [
            ...nodes,
            replacementNode,
            buildViralVideoBatchNode(batchNodeId, { x: sourceNode.position.x + sourceNode.width + 1560, y: sourceNode.position.y }, createViralBatchRecipe({ id: `recipe-${batchNodeId}`, candidateCount: 1 })),
            buildViralVideoResultsNode(resultsNodeId, { x: sourceNode.position.x + sourceNode.width + 2300, y: sourceNode.position.y }),
        ],
        workflow: {
            kind: "viral-video-remake",
            sourceVideoNodeId,
            replacementNodeId,
            batchNodeId,
            resultsNodeId,
            replacementBrief: "",
            candidateCount: 1,
            phase: "idle",
            machine: createViralWorkflowMachine(),
        },
    };
}

export function getViralVideoRemakePrimaryAction(phase: ViralVideoRemakeWorkflowState["phase"]): ViralVideoRemakePrimaryAction {
    if (phase === "idle" || phase === "recognizing") return "analyze";
    if (phase === "requirements_ready" || phase === "templating") return "plan-and-generate";
    return "generate";
}

export const viralVideoAnalysisStages = [
    "时间轴信息提取：正在标注每个镜头的开始时间、结束时间与时长。",
    "叙事要素解析：正在识别场景、可见角色、对白与关键叙事信息。",
    "镜头语言解构：正在检查景别、构图、画框、机位与运镜方式。",
    "视觉风格提炼：正在分析光影、色彩、景深、剪辑节奏与整体观感。",
    "声音与叙事洞察：正在检查音乐、音效、镜头目的与故事推进。",
    "拉片结果整理：正在校验时间轴连续性并创建画布节点。",
] as const;
