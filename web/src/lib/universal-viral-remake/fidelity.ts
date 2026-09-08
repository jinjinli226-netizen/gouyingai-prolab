import type {
    UniversalBoundTemplate,
    UniversalFidelityReport,
    UniversalPromptDifference,
    UniversalPromptPatch,
    UniversalSourceReconstruction,
} from "./types";

export function compareUniversalRemakeFidelity(input: {
    source: UniversalSourceReconstruction;
    candidate: UniversalBoundTemplate;
    patches: UniversalPromptPatch[];
}): UniversalFidelityReport {
    const { source, candidate, patches } = input;
    const allowedChanges: UniversalPromptDifference[] = [];
    const forbiddenChanges: UniversalPromptDifference[] = [];
    const patchByUnit = new Map(patches.map((patch) => [patch.timelineUnitId, patch]));

    if (candidate.reconstructionId !== source.id || candidate.timelineUnits.length !== source.timelineUnits.length) {
        forbiddenChanges.push({ kind: "timeline-structure", summary: "候选时间轴不再对应已验证原片" });
    }

    source.timelineUnits.forEach((sourceUnit, index) => {
        const candidateUnit = candidate.timelineUnits[index];
        if (!candidateUnit || candidateUnit.id !== sourceUnit.id) {
            forbiddenChanges.push({ kind: "timeline-order", timelineUnitId: sourceUnit.id, summary: `时间单元 ${sourceUnit.id} 的顺序或身份发生变化` });
            return;
        }

        if (
            candidateUnit.sourceStartSeconds !== sourceUnit.sourceStartSeconds
            || candidateUnit.sourceEndSeconds !== sourceUnit.sourceEndSeconds
        ) {
            forbiddenChanges.push({ kind: "timeline-timing", timelineUnitId: sourceUnit.id, summary: `时间单元 ${sourceUnit.id} 的起止时间发生变化` });
        }

        if (
            candidateUnit.parentShotIndex !== sourceUnit.parentShotIndex
            || candidateUnit.boundaryAfter !== sourceUnit.boundaryAfter
            || stable(candidateUnit.placeholderIds) !== stable(sourceUnit.placeholderIds)
        ) {
            forbiddenChanges.push({ kind: "timeline-structure", timelineUnitId: sourceUnit.id, summary: `时间单元 ${sourceUnit.id} 的镜头或对象结构发生变化` });
        }

        if (
            stable(candidateUnit.startContinuity) !== stable(sourceUnit.startContinuity)
            || stable(candidateUnit.endContinuity) !== stable(sourceUnit.endContinuity)
            || stable(candidateUnit.safeContinuationPoints) !== stable(sourceUnit.safeContinuationPoints)
        ) {
            forbiddenChanges.push({ kind: "continuity", timelineUnitId: sourceUnit.id, summary: `时间单元 ${sourceUnit.id} 的人物、物体、镜头或声音连续状态发生变化` });
        }

        if (stable(candidateUnit.structuralInvariants) !== stable(sourceUnit.structuralInvariants)) {
            forbiddenChanges.push({ kind: "timeline-structure", timelineUnitId: sourceUnit.id, summary: `时间单元 ${sourceUnit.id} 的结构不变量发生变化` });
        }

        if (stable(candidateUnit.eventFacts) !== stable(sourceUnit.eventFacts)) {
            forbiddenChanges.push({ kind: "event-fact", timelineUnitId: sourceUnit.id, summary: `时间单元 ${sourceUnit.id} 的已验证事件事实发生变化` });
        }

        if (stable(candidateUnit.capabilityCoverage) !== stable(sourceUnit.capabilityCoverage)) {
            forbiddenChanges.push({ kind: "capability-coverage", timelineUnitId: sourceUnit.id, summary: `时间单元 ${sourceUnit.id} 的通用能力检查结果发生变化` });
        }

        const patch = patchByUnit.get(sourceUnit.id);
        if (patch) {
            if (patch.beforeDirection !== sourceUnit.direction || candidateUnit.direction !== patch.afterDirection) {
                forbiddenChanges.push({ kind: "timeline-direction", timelineUnitId: sourceUnit.id, summary: `时间单元 ${sourceUnit.id} 没有严格应用已授权的局部改动` });
            } else if (patch.beforeDirection !== patch.afterDirection) {
                allowedChanges.push({ kind: "explicit-patch", timelineUnitId: sourceUnit.id, summary: `时间单元 ${sourceUnit.id} 应用了用户明确授权的局部改动` });
            }
        } else if (candidateUnit.direction !== sourceUnit.direction) {
            forbiddenChanges.push({ kind: "timeline-direction", timelineUnitId: sourceUnit.id, summary: `时间单元 ${sourceUnit.id} 的动作、文字或镜头描述发生未授权改写` });
        }
    });

    candidate.entityManifest.forEach((entity) => {
        if (entity.replacementEntityId) {
            allowedChanges.push({ kind: "entity-binding", summary: `${entity.placeholderId} 已替换为对象 ${entity.replacementEntityId}` });
        }
    });

    return { passed: forbiddenChanges.length === 0, allowedChanges, forbiddenChanges };
}

function stable(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
    if (value && typeof value === "object") {
        return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => `${key}:${stable(entry)}`).join(",")}}`;
    }
    return JSON.stringify(value);
}
