import {
    VIRAL_VIDEO_DOMAIN_SCHEMA_VERSION,
    type ViralMustKeepEvent,
    type ViralObjectFingerprint,
    type ViralReplacementBinding,
} from "./viral-video-domain";

export type ViralExplicitBinding = Pick<ViralReplacementBinding, "sourceObjectId" | "replacementObjectId">;

export function bindViralVideoReplacementObjects(
    sourceObjects: ViralObjectFingerprint[],
    replacementObjects: ViralObjectFingerprint[],
    events: Array<Pick<ViralMustKeepEvent, "id" | "involvedObjectIds">> = [],
    explicitBindings: ViralExplicitBinding[] = [],
): ViralReplacementBinding[] {
    const replacementsById = new Map(replacementObjects.map((object) => [object.id, object]));
    const explicitBySource = new Map(explicitBindings.map((binding) => [binding.sourceObjectId, binding.replacementObjectId]));

    return sourceObjects.map((source) => {
        const affectedEventIds = events.filter((event) => event.involvedObjectIds.includes(source.id)).map((event) => event.id);
        const explicitReplacementId = explicitBySource.get(source.id);
        if (explicitReplacementId) {
            const explicitReplacement = replacementsById.get(explicitReplacementId);
            return createBinding(source, explicitReplacementId, affectedEventIds, {
                mode: "user-confirmed",
                status: explicitReplacement ? "bound" : "conflict",
                confidence: explicitReplacement ? 1 : 0,
                reason: explicitReplacement ? "用户已在来源对象下明确上传并确认此替换对象" : "明确绑定的替换对象已不存在",
            });
        }

        const sameKind = replacementObjects.filter((replacement) => replacement.kind === source.kind);
        const sameRole = sameKind.filter((replacement) => replacement.role === source.role);
        const candidates = sameRole.length ? sameRole : sameKind;
        if (candidates.length === 1) {
            const match = candidates[0];
            const isHeroProduct = source.role === "hero-product" && match.role === "hero-product";
            return createBinding(source, match.id, affectedEventIds, {
                mode: "auto",
                status: "bound",
                confidence: isHeroProduct ? 0.98 : 0.9,
                reason: isHeroProduct ? "来源与上传素材均为唯一主商品，已自动锁定" : "对象类型与叙事角色唯一匹配",
            });
        }

        if (candidates.length > 1) {
            const ranked = [...candidates].sort((left, right) => similarityScore(source, right) - similarityScore(source, left));
            const firstScore = similarityScore(source, ranked[0]);
            const secondScore = similarityScore(source, ranked[1]);
            const decisive = firstScore >= 0.8 && firstScore - secondScore >= 0.2;
            return createBinding(source, ranked[0].id, affectedEventIds, {
                mode: "auto",
                status: decisive ? "suggested" : "needs-confirmation",
                confidence: Math.min(0.89, firstScore),
                reason: decisive ? "存在多个同类素材，已按可见特征给出优先建议" : "存在多个同类替换对象，无法可靠判断对应关系",
            });
        }

        return createBinding(source, "", affectedEventIds, {
            mode: "auto",
            status: "needs-confirmation",
            confidence: 0,
            reason: "尚未上传与此来源对象类型匹配的替换素材",
        });
    });
}

export function findViralVideoBindingIssues(bindings: ViralReplacementBinding[]): string[] {
    return bindings
        .filter((binding) => binding.status === "needs-confirmation" || binding.status === "conflict")
        .map((binding) => `${binding.sourceObjectId}：${binding.reason}`);
}

function createBinding(
    source: ViralObjectFingerprint,
    replacementObjectId: string,
    affectedEventIds: string[],
    fields: Pick<ViralReplacementBinding, "mode" | "status" | "confidence" | "reason">,
): ViralReplacementBinding {
    return {
        schemaVersion: VIRAL_VIDEO_DOMAIN_SCHEMA_VERSION,
        id: `binding-${source.id}`,
        sourceObjectId: source.id,
        replacementObjectId,
        affectedEventIds,
        ...fields,
    };
}

function similarityScore(source: ViralObjectFingerprint, replacement: ViralObjectFingerprint): number {
    let score = source.kind === replacement.kind ? 0.45 : 0;
    if (source.role === replacement.role) score += 0.25;
    const sourceFacts = new Set(normalizedFacts(source));
    const replacementFacts = new Set(normalizedFacts(replacement));
    const overlap = [...sourceFacts].filter((fact) => replacementFacts.has(fact)).length;
    const union = new Set([...sourceFacts, ...replacementFacts]).size;
    if (union) score += (overlap / union) * 0.3;
    return score;
}

function normalizedFacts(fingerprint: ViralObjectFingerprint): string[] {
    return [
        ...fingerprint.visualFacts.colors,
        ...fingerprint.visualFacts.materials,
        fingerprint.visualFacts.shape,
        ...fingerprint.visualFacts.markings,
        ...fingerprint.visualFacts.distinctiveFeatures,
        ...fingerprint.functionalFacts,
    ]
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
}
