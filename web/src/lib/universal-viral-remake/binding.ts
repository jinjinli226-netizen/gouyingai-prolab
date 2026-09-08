import type {
    UniversalBindingResolution,
    UniversalBoundTemplate,
    UniversalEntityBinding,
    UniversalPromptPatch,
    UniversalReplacementEntity,
    UniversalSourceEntity,
    UniversalSourceReconstruction,
} from "./types";

export type UniversalExplicitBinding = { sourceEntityId: string; replacementEntityId: string };

export function remapUniversalExplicitBindings(
    previousEntities: UniversalSourceEntity[],
    nextEntities: UniversalSourceEntity[],
    bindings: UniversalExplicitBinding[],
): UniversalExplicitBinding[] {
    const previousById = new Map(previousEntities.map((entity) => [entity.id, entity]));
    const nextById = new Map(nextEntities.map((entity) => [entity.id, entity]));
    const result: UniversalExplicitBinding[] = [];
    const seen = new Set<string>();

    for (const binding of bindings) {
        const previous = previousById.get(binding.sourceEntityId);
        if (!previous) continue;
        const exactId = nextById.get(previous.id);
        const exactPlaceholder = nextEntities.find((entity) => entity.placeholderId === previous.placeholderId && entity.kind === previous.kind);
        const previousAliases = new Set((previous.sourceAliases ?? []).map((alias) => alias.trim().toLocaleLowerCase()).filter(Boolean));
        const aliasMatch = previousAliases.size
            ? nextEntities.find((entity) => entity.kind === previous.kind && (entity.sourceAliases ?? []).some((alias) => previousAliases.has(alias.trim().toLocaleLowerCase())))
            : undefined;
        const sameKind = nextEntities.filter((entity) => entity.kind === previous.kind);
        const next = exactId ?? exactPlaceholder ?? aliasMatch ?? (sameKind.length === 1 ? sameKind[0] : undefined);
        if (!next) continue;
        const key = `${next.id}\u0000${binding.replacementEntityId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({ sourceEntityId: next.id, replacementEntityId: binding.replacementEntityId });
    }
    return result;
}

export function resolveUniversalRemakeBindings(
    sourceEntities: UniversalSourceEntity[],
    replacementEntities: UniversalReplacementEntity[],
    explicitBindings: UniversalExplicitBinding[],
): UniversalBindingResolution {
    const sourceById = new Map(sourceEntities.map((entity) => [entity.id, entity]));
    const replacementById = new Map(replacementEntities.map((entity) => [entity.id, entity]));
    const explicitBySource = new Map(explicitBindings.map((binding) => [binding.sourceEntityId, binding.replacementEntityId]));
    const bindings: UniversalEntityBinding[] = [];
    const issues: string[] = [];

    for (const explicit of explicitBindings) {
        const source = sourceById.get(explicit.sourceEntityId);
        const replacement = replacementById.get(explicit.replacementEntityId);
        if (!source || !replacement) throw new Error("显式替换关系引用了不存在的对象");
        if (source.kind !== replacement.kind) throw new Error(`对象 ${source.id} 与 ${replacement.id} 的类型不一致`);
    }

    const sourceKindCounts = countKinds(sourceEntities);
    const replacementKindCounts = countKinds(replacementEntities);

    for (const source of sourceEntities) {
        const explicitReplacementId = explicitBySource.get(source.id);
        if (explicitReplacementId) {
            bindings.push({ placeholderId: source.placeholderId, sourceEntityId: source.id, replacementEntityId: explicitReplacementId, status: "user-confirmed" });
            continue;
        }

        const sameKind = replacementEntities.filter((replacement) => replacement.kind === source.kind);
        if (!sameKind.length) {
            bindings.push({ placeholderId: source.placeholderId, sourceEntityId: source.id, status: "source-only" });
            continue;
        }

        if (sourceKindCounts.get(source.kind) === 1 && replacementKindCounts.get(source.kind) === 1) {
            bindings.push({ placeholderId: source.placeholderId, sourceEntityId: source.id, replacementEntityId: sameKind[0].id, status: "auto-bound" });
            continue;
        }

        bindings.push({ placeholderId: source.placeholderId, sourceEntityId: source.id, status: "ambiguous" });
        if (!issues.some((issue) => issue.includes(source.kind))) issues.push(`${source.kind} 类型存在多个原片对象或替换对象，需要确认对应关系`);
    }

    return { status: issues.length ? "needs-confirmation" : "ready", bindings, issues };
}

export function applyUniversalRemakeBindings(
    reconstruction: UniversalSourceReconstruction,
    replacementEntities: UniversalReplacementEntity[],
    bindings: UniversalEntityBinding[],
    patches: UniversalPromptPatch[],
): UniversalBoundTemplate {
    if (bindings.some((binding) => binding.status === "ambiguous")) throw new Error("替换关系尚有歧义，不能编译复刻母版");
    const replacementById = new Map(replacementEntities.map((entity) => [entity.id, entity]));
    const bindingBySource = new Map(bindings.map((binding) => [binding.sourceEntityId, binding]));
    const unitById = new Map(reconstruction.timelineUnits.map((unit) => [unit.id, unit]));
    const patchByUnit = new Map<string, UniversalPromptPatch>();

    for (const patch of patches) {
        const sourceUnit = unitById.get(patch.timelineUnitId);
        if (!sourceUnit) throw new Error(`局部改动引用了不存在的时间单元 ${patch.timelineUnitId}`);
        if (sourceUnit.direction !== patch.beforeDirection) throw new Error(`局部改动 ${patch.id} 与已验证原片内容不匹配`);
        if (patchByUnit.has(patch.timelineUnitId)) throw new Error(`时间单元 ${patch.timelineUnitId} 存在重复局部改动`);
        patchByUnit.set(patch.timelineUnitId, patch);
    }

    const entityManifest = reconstruction.entities.map((source) => {
        const binding = bindingBySource.get(source.id) ?? { placeholderId: source.placeholderId, sourceEntityId: source.id, status: "source-only" as const };
        const replacement = binding.replacementEntityId ? replacementById.get(binding.replacementEntityId) : undefined;
        if (binding.replacementEntityId && !replacement) throw new Error(`替换对象 ${binding.replacementEntityId} 不存在`);
        return {
            placeholderId: source.placeholderId,
            sourceEntityId: source.id,
            replacementEntityId: replacement?.id,
            kind: source.kind,
            identityFacts: replacement?.identityFacts ?? source.identityFacts,
            sourceAliases: [...(source.sourceAliases ?? [])],
            behavioralRole: source.behavioralRole,
            physicalInstanceCount: source.physicalInstanceCount,
            referenceAssetIds: replacement?.referenceAssetIds ?? [],
        };
    });

    const timelineUnits = reconstruction.timelineUnits.map((unit) => {
        const patch = patchByUnit.get(unit.id);
        return { ...unit, direction: patch?.afterDirection ?? unit.direction };
    });

    return {
        schemaVersion: reconstruction.schemaVersion,
        reconstructionId: reconstruction.id,
        durationSeconds: reconstruction.durationSeconds,
        aspectRatio: reconstruction.aspectRatio,
        entityManifest,
        bindings: bindings.map((binding) => ({ ...binding })),
        timelineUnits,
        canonicalPrompt: timelineUnits.map((unit) => unit.direction).join("\n"),
    };
}

function countKinds<T extends { kind: string }>(entities: T[]): Map<string, number> {
    const counts = new Map<string, number>();
    entities.forEach((entity) => counts.set(entity.kind, (counts.get(entity.kind) ?? 0) + 1));
    return counts;
}
