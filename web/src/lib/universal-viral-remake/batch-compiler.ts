import { compileUniversalSegmentPrompt } from "./prompt-compiler";
import type {
    UniversalBatchRecipe,
    UniversalBatchSummary,
    UniversalCandidateManifest,
    UniversalCompiledEntity,
    UniversalRemakeTemplate,
    UniversalVariableSlot,
    UniversalVideoModelCapabilities,
} from "./types";
import { UNIVERSAL_REMAKE_SCHEMA_VERSION } from "./types";
import { hasCompleteUniversalCapabilityCoverage } from "./capabilities";
import { parseUniversalDirectorPromptPlan } from "./director-prompt";

export function normalizeUniversalRemakeCandidateCount(value?: number): number {
    if (!Number.isFinite(value)) return 1;
    return Math.max(1, Math.min(1000, Math.floor(value as number)));
}

export function withUniversalSourceVisualAnchors(
    template: UniversalRemakeTemplate,
    sourceReferenceAssetIds: string[],
    sourceAnchorTimes: number[] = [],
): UniversalRemakeTemplate {
    const anchors = [...new Set(sourceReferenceAssetIds.map((assetId) => assetId.trim()).filter(Boolean))];
    if (!anchors.length || template.entityManifest.some((entity) => Boolean(entity.replacementEntityId))) return template;
    return {
        ...template,
        sourceVisualReferences: anchors.map((assetId, index) => index === 0
            ? { assetId, kind: "storyboard" as const }
            : {
                assetId,
                kind: "anchor" as const,
                ...(Number.isFinite(sourceAnchorTimes[index - 1]) ? { atSeconds: sourceAnchorTimes[index - 1] } : {}),
            }),
        entityManifest: template.entityManifest.map((entity) => ({
            ...entity,
            referenceAssetIds: [...new Set([...entity.referenceAssetIds, ...anchors])],
        })),
    };
}

export function compileUniversalRemakeCandidates(
    template: UniversalRemakeTemplate,
    recipe: UniversalBatchRecipe,
    capabilities: UniversalVideoModelCapabilities,
): UniversalCandidateManifest[] {
    if (!template.fidelity.passed) throw new Error("通用复刻母版没有通过忠实度门禁");
    if (template.segmentPlan.status !== "ready") throw new Error("通用复刻母版还没有可执行的片段计划");
    const executableTemplate = validateExecutableTemplate(template);
    validateVariableSlots(executableTemplate, recipe.variableSlots);

    const count = normalizeUniversalRemakeCandidateCount(recipe.count);
    const candidates: UniversalCandidateManifest[] = [];
    for (let index = 0; index < count; index += 1) {
        const { entityManifest, slotSelections } = applyVariableSelections(executableTemplate.entityManifest, recipe.variableSlots, index);
        const candidateId = `${executableTemplate.id}:candidate:${index + 1}`;
        const segments = executableTemplate.segmentPlan.segments.map((segment, segmentIndex) => {
            const id = `${candidateId}:segment:${segmentIndex + 1}`;
            const previousId = segmentIndex > 0 ? `${candidateId}:segment:${segmentIndex}` : undefined;
            return {
                id,
                index: segmentIndex,
                prompt: compileUniversalSegmentPrompt(executableTemplate, segment, entityManifest, capabilities),
                durationSeconds: segment.durationSeconds,
                sourceStartSeconds: segment.sourceStartSeconds,
                sourceEndSeconds: segment.sourceEndSeconds,
                aspectRatio: executableTemplate.aspectRatio,
                modelId: capabilities.modelId,
                referenceAssetIds: segmentReferenceAssets(executableTemplate, entityManifest, segment),
                timelineUnitIds: [...segment.timelineUnitIds],
                continuationFrameFromSegmentId: capabilities.supportsContinuationFrame ? previousId : undefined,
            };
        });
        const totalGeneratedSeconds = segments.reduce((total, segment) => total + segment.durationSeconds, 0);
        const requiresDurationNormalization = Math.abs(executableTemplate.durationSeconds - Math.round(executableTemplate.durationSeconds)) > 0.001;
        const output = segments.length === 1 && !requiresDurationNormalization
            ? { kind: "direct-video" as const, sourceSegmentId: segments[0].id, targetDurationSeconds: executableTemplate.durationSeconds }
            : {
                kind: "composed-video" as const,
                orderedSegmentIds: segments.map((segment) => segment.id),
                boundaryKinds: executableTemplate.segmentPlan.segments.slice(0, -1).map((segment) => segment.boundaryAfter),
                targetDurationSeconds: executableTemplate.durationSeconds,
                aspectRatio: executableTemplate.aspectRatio,
                audioPolicy: "segment-native" as const,
            };
        candidates.push({
            id: candidateId,
            index,
            templateId: executableTemplate.id,
            seed: recipe.seed + index,
            slotSelections,
            entityManifest,
            bindings: executableTemplate.bindings.map((binding) => ({ ...binding })),
            segments,
            output,
            totalGeneratedSeconds,
        });
    }
    return candidates;
}

function validateExecutableTemplate(template: UniversalRemakeTemplate): UniversalRemakeTemplate {
    if (template.schemaVersion !== UNIVERSAL_REMAKE_SCHEMA_VERSION) throw new Error("当前复刻母版仍是固定字段旧版，缺少自适应结构不变量，请重新拉片后再提交生成");
    const incompleteInvariants = template.timelineUnits.some((unit) => !unit.structuralInvariants?.length || unit.structuralInvariants.some((invariant) =>
        !invariant.id?.trim()
        || !invariant.dimension?.trim()
        || !invariant.description?.trim()
        || !Array.isArray(invariant.participantPlaceholderIds)
        || !Array.isArray(invariant.evidenceIds)
        || !["critical", "supporting"].includes(invariant.importance)
        || !Number.isFinite(invariant.confidence)
        || invariant.confidence < 0
        || invariant.confidence > 1));
    if (incompleteInvariants) throw new Error("当前复刻母版缺少有效的自适应结构不变量，请重新拉片后再提交生成");
    if (template.timelineUnits.some((unit) => !hasCompleteUniversalCapabilityCoverage(unit) || !unit.eventFacts?.length)) {
        throw new Error("当前复刻母版缺少完整的通用能力检查或事件事实，请重新拉片后再提交生成");
    }
    if (template.entityManifest.some((entity) => !Number.isInteger(entity.physicalInstanceCount) || entity.physicalInstanceCount < 1)) {
        throw new Error("当前复刻母版缺少物理实例数量，请重新拉片后再提交生成");
    }
    const incompleteContinuity = template.timelineUnits.some((unit) => !hasExecutableContinuity(unit.startContinuity)
        || !hasExecutableContinuity(unit.endContinuity)
        || !Array.isArray(unit.safeContinuationPoints)
        || unit.safeContinuationPoints.some((point) => !hasExecutableContinuity(point.continuity)));
    if (incompleteContinuity) throw new Error("当前复刻母版缺少自适应连续性事实，请重新拉片后再提交生成");
    if (template.entityManifest.some((entity) => entity.replacementEntityId && !(entity.sourceAliases?.length))) {
        throw new Error("当前复刻母版缺少替换排他信息，请重新拉片后再提交生成");
    }
    return template.directorPromptPlan
        ? { ...template, directorPromptPlan: parseUniversalDirectorPromptPlan(template.directorPromptPlan, template) }
        : template;
}

function hasExecutableContinuity(value: UniversalRemakeTemplate["timelineUnits"][number]["startContinuity"] | undefined): boolean {
    return Boolean(value) && Array.isArray(value!.facts) && value!.facts.every((fact) => Boolean(fact.dimension?.trim())
        && Boolean(fact.description?.trim()) && Array.isArray(fact.participantPlaceholderIds));
}

export function summarizeUniversalRemakeBatch(candidates: UniversalCandidateManifest[]): UniversalBatchSummary {
    return candidates.reduce<UniversalBatchSummary>((summary, candidate) => ({
        candidateCount: summary.candidateCount + 1,
        segmentCallCount: summary.segmentCallCount + candidate.segments.length,
        compositionCallCount: summary.compositionCallCount + (candidate.output.kind === "composed-video" ? 1 : 0),
        totalGeneratedSeconds: summary.totalGeneratedSeconds + candidate.totalGeneratedSeconds,
    }), { candidateCount: 0, segmentCallCount: 0, compositionCallCount: 0, totalGeneratedSeconds: 0 });
}

function validateVariableSlots(template: UniversalRemakeTemplate, slots: UniversalVariableSlot[]): void {
    const placeholders = new Set(template.entityManifest.map((entity) => entity.placeholderId));
    const slotIds = new Set<string>();
    for (const slot of slots) {
        if (!slot.id.trim() || slotIds.has(slot.id)) throw new Error(`批量变量槽 ID 无效或重复：${slot.id}`);
        if (!placeholders.has(slot.targetPlaceholderId)) throw new Error(`批量变量槽 ${slot.id} 引用了不存在的占位符`);
        if (!slot.options.length) throw new Error(`批量变量槽 ${slot.id} 没有可选值`);
        slotIds.add(slot.id);
    }
}

function applyVariableSelections(
    baseManifest: UniversalCompiledEntity[],
    slots: UniversalVariableSlot[],
    candidateIndex: number,
): { entityManifest: UniversalCompiledEntity[]; slotSelections: Record<string, string> } {
    const entityManifest = baseManifest.map((entity) => ({ ...entity, referenceAssetIds: [...entity.referenceAssetIds] }));
    const byPlaceholder = new Map(entityManifest.map((entity) => [entity.placeholderId, entity]));
    const slotSelections: Record<string, string> = {};
    let combinationIndex = candidateIndex;
    for (const slot of slots) {
        const option = slot.options[combinationIndex % slot.options.length];
        combinationIndex = Math.floor(combinationIndex / slot.options.length);
        const entity = byPlaceholder.get(slot.targetPlaceholderId);
        if (!entity) throw new Error(`批量变量槽 ${slot.id} 的目标占位符不存在`);
        entity.identityFacts = option.identityFacts;
        entity.referenceAssetIds = [...option.referenceAssetIds];
        slotSelections[slot.id] = option.id;
    }
    return { entityManifest, slotSelections };
}

function stableReferenceAssets(entityManifest: UniversalCompiledEntity[]): string[] {
    const seen = new Set<string>();
    const assets: string[] = [];
    for (const entity of entityManifest) {
        for (const assetId of entity.referenceAssetIds) {
            if (seen.has(assetId)) continue;
            seen.add(assetId);
            assets.push(assetId);
        }
    }
    return assets;
}

function segmentReferenceAssets(
    template: UniversalRemakeTemplate,
    entityManifest: UniversalCompiledEntity[],
    segment: UniversalRemakeTemplate["segmentPlan"]["segments"][number],
): string[] {
    const allEntityReferences = stableReferenceAssets(entityManifest);
    const sourceReferences = template.sourceVisualReferences || [];
    if (!sourceReferences.length) return allEntityReferences;
    const sourceIds = new Set(sourceReferences.map((reference) => reference.assetId));
    const identityReferences = allEntityReferences.filter((assetId) => !sourceIds.has(assetId));
    const segmentSourceReferences = template.segmentPlan.segments.length === 1
        ? sourceReferences
        : sourceReferences.filter((reference) => reference.kind === "anchor"
            && Number.isFinite(reference.atSeconds)
            && reference.atSeconds! >= segment.sourceStartSeconds - 0.001
            && (segment.index === template.segmentPlan.segments.length - 1
                ? reference.atSeconds! <= segment.sourceEndSeconds + 0.001
                : reference.atSeconds! < segment.sourceEndSeconds - 0.001));
    return [...new Set([...identityReferences, ...segmentSourceReferences.map((reference) => reference.assetId)])];
}
