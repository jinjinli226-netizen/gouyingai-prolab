import { applyUniversalRemakeBindings, resolveUniversalRemakeBindings } from "./binding";
import { compileUniversalRemakeCandidates, summarizeUniversalRemakeBatch } from "./batch-compiler";
import { compareUniversalRemakeFidelity } from "./fidelity";
import { reconstructUniversalSource } from "./reconstruction";
import { planUniversalRemakeSegments } from "./segmentation";
import type { UniversalRemakePreparation, UniversalRemakePreparationInput, UniversalRemakeUnderstandingPort } from "./types";
import { verifyUniversalSourceReconstruction } from "./verification";
import { UNIVERSAL_REMAKE_SCHEMA_VERSION } from "./types";
import { hasCompleteUniversalCapabilityCoverage } from "./capabilities";

export async function prepareUniversalRemake(
    input: UniversalRemakePreparationInput,
    port: UniversalRemakeUnderstandingPort,
): Promise<UniversalRemakePreparation> {
    const initial = await reconstructUniversalSource(input.source, port);
    const reconstruction = await verifyUniversalSourceReconstruction(input.source, initial, port);
    return compileVerifiedUniversalRemake({ ...input, reconstruction });
}

export function compileVerifiedUniversalRemake(input: Omit<UniversalRemakePreparationInput, "source"> & { reconstruction: Parameters<typeof applyUniversalRemakeBindings>[0] }): UniversalRemakePreparation {
    const reconstruction = input.reconstruction;
    if (!reconstruction.verification || !["verified", "repaired"].includes(reconstruction.verification.status)) {
        return { status: "needs-refinement", reconstruction, issues: ["原片重建尚未通过独立二次校验"] };
    }
    const structuralIssues = validateExecutableReconstruction(reconstruction);
    if (structuralIssues.length) return { status: "needs-refinement", reconstruction, issues: structuralIssues };
    const resolution = resolveUniversalRemakeBindings(reconstruction.entities, input.replacements, input.explicitBindings);
    if (resolution.status !== "ready") return { status: "needs-confirmation", reconstruction, issues: resolution.issues };
    const aliasesMissingForReplacements = resolution.bindings
        .filter((binding) => binding.replacementEntityId)
        .filter((binding) => !(reconstruction.entities.find((entity) => entity.id === binding.sourceEntityId)?.sourceAliases?.length));
    if (aliasesMissingForReplacements.length) {
        return { status: "needs-refinement", reconstruction, issues: ["已替换对象缺少原身份别名，无法阻止新旧对象同时出现；请重新拉片"] };
    }

    const bound = applyUniversalRemakeBindings(reconstruction, input.replacements, resolution.bindings, input.patches);
    const segmentPlan = planUniversalRemakeSegments(reconstruction, { maxDurationSeconds: input.capabilities.maxDurationSeconds });
    if (segmentPlan.status !== "ready") return { status: "needs-refinement", reconstruction, issues: segmentPlan.issues };

    const fidelity = compareUniversalRemakeFidelity({ source: reconstruction, candidate: bound, patches: input.patches });
    if (!fidelity.passed) return { status: "needs-refinement", reconstruction, issues: fidelity.forbiddenChanges.map((change) => change.summary) };

    const templateBase = {
        id: `${reconstruction.id}:template:${input.capabilities.modelId}`,
        ...bound,
        segmentPlan,
        fidelity,
        patches: input.patches.map((patch) => ({ ...patch })),
    };
    const candidates = compileUniversalRemakeCandidates(templateBase, input.recipe, input.capabilities);
    const template = {
        ...templateBase,
        compiledPromptPreview: candidates[0]?.segments.map((segment) => segment.prompt).join("\n\n===== NEXT GENERATED SEGMENT =====\n\n") ?? "",
    };
    return { status: "ready", reconstruction, template, candidates, summary: summarizeUniversalRemakeBatch(candidates) };
}

function validateExecutableReconstruction(reconstruction: Parameters<typeof applyUniversalRemakeBindings>[0]): string[] {
    const issues: string[] = [];
    if (reconstruction.schemaVersion !== UNIVERSAL_REMAKE_SCHEMA_VERSION) {
        issues.push("当前母版仍是固定字段旧版，缺少自适应结构不变量；请重新拉片");
    }
    if (reconstruction.entities.some((entity) => !Array.isArray(entity.sourceAliases))) {
        issues.push("当前母版缺少对象替换别名，不能安全替换；请重新拉片");
    }
    if (reconstruction.timelineUnits.some((unit) => !hasExecutableInvariants(unit.structuralInvariants))) {
        issues.push("当前母版缺少有效的自适应结构不变量，不能可靠复刻；请重新拉片");
    }
    if (reconstruction.timelineUnits.some((unit) => !hasCompleteUniversalCapabilityCoverage(unit)
        || unit.eventFacts.some((fact) => !fact.id?.trim() || !fact.dimension?.trim() || !fact.predicate?.trim()
            || !Array.isArray(fact.participantRoles) || !Array.isArray(fact.evidenceIds)
            || !["critical", "supporting"].includes(fact.importance)
            || !Number.isFinite(fact.confidence) || fact.confidence < 0 || fact.confidence > 1))) {
        issues.push("当前母版的通用能力检查或事件事实证据不完整；请重新拉片");
    }
    if (reconstruction.entities.some((entity) => !Number.isInteger(entity.physicalInstanceCount) || entity.physicalInstanceCount < 1)) {
        issues.push("当前母版缺少可靠的物理实例数量；请重新拉片");
    }
    if (reconstruction.timelineUnits.some((unit) => !hasExecutableContinuity(unit.startContinuity) || !hasExecutableContinuity(unit.endContinuity)
        || !Array.isArray(unit.safeContinuationPoints) || unit.safeContinuationPoints.some((point) => !hasExecutableContinuity(point.continuity)))) {
        issues.push("当前母版缺少自适应连续性事实，长视频不能可靠续接；请重新拉片");
    }
    return issues;
}

function hasExecutableInvariants(value: Parameters<typeof applyUniversalRemakeBindings>[0]["timelineUnits"][number]["structuralInvariants"] | undefined): boolean {
    return Boolean(value?.length) && value!.every((invariant) => Boolean(invariant.id?.trim())
        && Boolean(invariant.dimension?.trim())
        && Boolean(invariant.description?.trim())
        && Array.isArray(invariant.participantPlaceholderIds)
        && Array.isArray(invariant.evidenceIds)
        && ["critical", "supporting"].includes(invariant.importance)
        && Number.isFinite(invariant.confidence) && invariant.confidence >= 0 && invariant.confidence <= 1);
}

function hasExecutableContinuity(value: Parameters<typeof applyUniversalRemakeBindings>[0]["timelineUnits"][number]["startContinuity"] | undefined): boolean {
    return Boolean(value) && Array.isArray(value!.facts) && value!.facts.every((fact) => Boolean(fact.dimension?.trim())
        && Boolean(fact.description?.trim()) && Array.isArray(fact.participantPlaceholderIds));
}
