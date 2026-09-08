import { CanvasNodeType, type CanvasNodeData, type Position } from "@/types/canvas";
import type { ViralVideoAnalysis, ViralVideoPromptPlan } from "./viral-video-remake-workflow";
import {
    VIRAL_VIDEO_DOMAIN_SCHEMA_VERSION,
    type ViralCoverageReport,
    type ViralExecutionBeat,
    type ViralMustKeepEvent,
    type ViralRemakeTemplate,
    type ViralReplacementBinding,
} from "./viral-video-domain";

export const VIRAL_VIDEO_TEMPLATE_NODE_SIZE = { width: 1320, height: 760 } as const;

export function evaluateViralTemplateCoverage(
    sourceEvents: ViralMustKeepEvent[],
    beats: Array<Pick<ViralExecutionBeat, "sourceEventId">>,
): ViralCoverageReport {
    const mappedCounts = new Map<string, number>();
    beats.forEach((beat) => mappedCounts.set(beat.sourceEventId, (mappedCounts.get(beat.sourceEventId) || 0) + 1));
    const missingEventIds = sourceEvents.filter((event) => !mappedCounts.has(event.id)).map((event) => event.id);
    const duplicatedEventIds = sourceEvents.filter((event) => (mappedCounts.get(event.id) || 0) > 1).map((event) => event.id);
    const p0Events = sourceEvents.filter((event) => event.priority === "P0");
    const missingP0EventIds = p0Events.filter((event) => (mappedCounts.get(event.id) || 0) !== 1).map((event) => event.id);
    const sourceSceneCount = new Set(sourceEvents.map((event) => event.parentShotIndex)).size;
    const mappedEvents = sourceEvents.filter((event) => mappedCounts.has(event.id));
    const mappedSceneCount = new Set(mappedEvents.map((event) => event.parentShotIndex)).size;
    const sourceDialogueCount = sourceEvents.filter((event) => event.audioCue.trim()).length;
    const mappedDialogueCount = sourceEvents.filter((event) => event.audioCue.trim() && mappedCounts.has(event.id)).length;
    const issues = [
        ...missingEventIds.map((id) => `事件 ${id} 未进入主模板`),
        ...duplicatedEventIds.map((id) => `事件 ${id} 在主模板中重复出现`),
        ...missingP0EventIds.map((id) => `P0 事件 ${id} 必须且只能出现一次`),
    ];
    return {
        schemaVersion: VIRAL_VIDEO_DOMAIN_SCHEMA_VERSION,
        id: "coverage-master-template",
        sourceEventCount: sourceEvents.length,
        mappedEventCount: mappedEvents.length,
        p0Count: p0Events.length,
        mappedP0Count: p0Events.filter((event) => (mappedCounts.get(event.id) || 0) === 1).length,
        sourceSceneCount,
        mappedSceneCount,
        sourceDialogueCount,
        mappedDialogueCount,
        missingEventIds,
        missingP0EventIds,
        passed: issues.length === 0,
        issues,
    };
}

export function buildViralRemakeTemplate(
    analysis: ViralVideoAnalysis,
    bindings: ViralReplacementBinding[],
    plan?: ViralVideoPromptPlan,
): ViralRemakeTemplate {
    const shotsByParent = new Map(analysis.shots.map((shot) => [shot.parentShotIndex, shot]));
    const beats: ViralExecutionBeat[] = analysis.mustKeepEvents.map((event, index) => {
        const shot = shotsByParent.get(event.parentShotIndex);
        const plannedPrompt = plan?.shotPrompts.find((item) => item.index === event.parentShotIndex)?.prompt;
        return {
            id: `beat-${index + 1}-${event.id}`,
            sourceEventId: event.id,
            startSeconds: event.targetStartSeconds,
            endSeconds: event.targetEndSeconds,
            visualAction: plannedPrompt || event.description,
            cameraIntent: shot ? [shot.shotSize, shot.composition, shot.cameraMovement].filter(Boolean).join("；") : "保持原片镜头功能",
            continuityAnchors: [event.startState, event.endState, ...(event.involvedObjectIds || [])].filter(Boolean),
        };
    });
    const coverage = evaluateViralTemplateCoverage(analysis.mustKeepEvents, beats);
    return {
        schemaVersion: VIRAL_VIDEO_DOMAIN_SCHEMA_VERSION,
        id: `template-${slug(analysis.title)}`,
        title: plan?.title || analysis.title,
        sourceDurationSeconds: analysis.durationSeconds,
        targetDurationSeconds: analysis.durationSeconds,
        aspectRatio: analysis.aspectRatio,
        hookMechanism: analysis.hook,
        narrativeStructure: analysis.narrativeStructure,
        objects: analysis.objects,
        bindings,
        characterBible: {
            characters: analysis.objects
                .filter((object) => object.kind === "person")
                .map((object) => ({
                    objectId: object.id,
                    identityFacts: [...object.visualFacts.distinctiveFeatures, ...object.visualFacts.colors, object.visualFacts.shape].filter(Boolean),
                    performanceRules: [plan?.elementPlan.characters || "身份、脸部、体型、发型与行为动机全片一致"],
                })),
        },
        wardrobeTimeline: analysis.objects
            .filter((object) => object.kind === "wardrobe")
            .map((object) => ({ objectId: object.id, startSeconds: 0, endSeconds: analysis.durationSeconds, visibleFacts: [...object.visualFacts.colors, ...object.visualFacts.materials, ...object.visualFacts.distinctiveFeatures] })),
        events: analysis.mustKeepEvents.map((event) => ({ ...event })),
        beats,
        audioPlan: {
            voiceover: analysis.shots.filter((shot) => shot.dialogue?.trim()).map((shot) => ({ startSeconds: shot.startSeconds, endSeconds: shot.endSeconds, text: shot.dialogue })),
            subtitles: analysis.shots.filter((shot) => shot.visibleText?.trim()).map((shot) => ({ startSeconds: shot.startSeconds, endSeconds: shot.endSeconds, text: shot.visibleText })),
            soundEffects: analysis.mustKeepEvents.filter((event) => event.audioCue.trim()).map((event) => ({ startSeconds: event.targetStartSeconds, cue: event.audioCue })),
            music: analysis.soundStrategy.trim() ? [{ startSeconds: 0, endSeconds: analysis.durationSeconds, description: analysis.soundStrategy }] : [],
        },
        continuityRules: [
            plan?.continuityRules || "人物、商品、场景、空间方向和动作状态在全部事件间连续",
            plan?.productContinuity || "绑定对象的身份、外形、比例、材质与标识全片固定",
            "每个 P0 事件按原始因果顺序执行一次，不得删除、合并或重复",
        ],
        coverage,
    };
}

export function buildViralVideoTemplateNode(input: {
    id: string;
    position: Position;
    template: ViralRemakeTemplate;
    masterPrompt: string;
    plannerPrompt: string;
    plan?: ViralVideoPromptPlan;
}): CanvasNodeData {
    return {
        id: input.id,
        type: CanvasNodeType.Text,
        title: `复刻母版 · ${input.template.title}`,
        position: input.position,
        width: VIRAL_VIDEO_TEMPLATE_NODE_SIZE.width,
        height: VIRAL_VIDEO_TEMPLATE_NODE_SIZE.height,
        metadata: {
            content: input.masterPrompt,
            prompt: input.masterPrompt,
            status: input.template.coverage.passed ? "success" : "error",
            fontSize: 14,
            viralVideoPromptPlan: input.plan,
            viralVideoPlannerPrompt: input.plannerPrompt,
            viralVideoPromptRole: "template",
            viralVideoPlanId: input.template.id,
            viralVideoRemakeTemplate: input.template,
        },
    };
}

function slug(value: string): string {
    return value.trim().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}-]/gu, "").slice(0, 48) || "viral-remake";
}
