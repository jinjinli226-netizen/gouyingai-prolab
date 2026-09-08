import { UNIVERSAL_REMAKE_SCHEMA_VERSION } from "./types";
import { UNIVERSAL_CAPABILITY_FAMILIES, UNIVERSAL_CAPABILITY_REGISTRY } from "./capabilities";
import type {
    UniversalContinuityState,
    UniversalReconstructionInput,
    UniversalRemakeUnderstandingPort,
    UniversalSourceReconstruction,
    UniversalTimelineUnit,
} from "./types";

export function createUniversalReconstructionPrompt(input: UniversalReconstructionInput): string {
    const evidenceId = input.evidence[0]?.id || "evidence-id";
    const outputContract = {
        schemaVersion: UNIVERSAL_REMAKE_SCHEMA_VERSION,
        id: `reconstruction:${input.sourceVideoId}`,
        sourceVideoId: input.sourceVideoId,
        durationSeconds: input.durationSeconds,
        aspectRatio: input.aspectRatio,
        entities: [{
            id: "source-entity-1",
            placeholderId: "@entity1",
            kind: "product | person | scene | vehicle | wardrobe | animal | prop | other",
            identityFacts: "Only stable visual identity facts observed in the evidence",
            sourceAliases: ["Every visible source-identity noun or short alias that must disappear when this entity is replaced"],
            behavioralRole: "What this entity does in the source, independent of its identity",
            physicalInstanceCount: 1,
            evidenceIds: [evidenceId],
            confidence: 0.95,
        }],
        timelineUnits: [{
            id: "unit-1",
            sourceStartSeconds: 0,
            sourceEndSeconds: input.durationSeconds,
            parentShotIndex: 0,
            direction: "Evidence-grounded action, camera, scene, dialogue, sound and state-change direction",
            structuralInvariants: [{
                id: "invariant-1",
                dimension: "Choose an evidence-specific dimension name instead of a fixed taxonomy",
                description: "The observable relationship or change that must remain true for this unit to be the same video structure",
                participantPlaceholderIds: ["@entity1"],
                evidenceIds: [evidenceId],
                importance: "critical | supporting",
                confidence: 0.95,
            }],
            eventFacts: [{
                id: "fact-1",
                family: "spatial-geometry",
                dimension: "Evidence-specific observable dimension",
                predicate: "One concrete placeholder-only fact observed during this exact interval",
                participantRoles: [{ placeholderId: "@entity1", role: "Evidence-specific semantic role" }],
                startSeconds: 0,
                endSeconds: input.durationSeconds,
                evidenceIds: [evidenceId],
                importance: "critical | supporting",
                confidence: 0.95,
                beforeState: "Observable initial state when a transition exists",
                afterState: "Observable terminal state when a transition exists",
            }],
            capabilityCoverage: UNIVERSAL_CAPABILITY_REGISTRY.map((capability, index) => ({
                family: capability.family,
                status: index === 2 ? "observed" : "not-observed | not-applicable | uncertain",
                factIds: index === 2 ? ["fact-1"] : [],
                reason: "Why this family is observed, absent, irrelevant, or uncertain for this unit",
                importance: index === 2 ? "critical" : "supporting",
            })),
            placeholderIds: ["@entity1"],
            evidenceIds: [evidenceId],
            boundaryAfter: "hard-cut | transition | semantic | continuous | none",
            safeContinuationPoints: [{
                atSeconds: Math.min(input.durationSeconds, 1),
                continuity: {
                    facts: [{
                        dimension: "Choose only a continuity dimension that is observable and needed at this continuation point",
                        description: "Exact state that the next generated segment must resume",
                        participantPlaceholderIds: ["@entity1"],
                    }],
                },
            }],
            startContinuity: {
                facts: [{
                    dimension: "Evidence-specific start-state dimension",
                    description: "Observable state at the unit start",
                    participantPlaceholderIds: ["@entity1"],
                }],
            },
            endContinuity: {
                facts: [{
                    dimension: "Evidence-specific end-state dimension",
                    description: "Observable state at the unit end",
                    participantPlaceholderIds: ["@entity1"],
                }],
            },
        }],
        canonicalPrompt: "One complete evidence-grounded generation prompt covering the observed source",
        evidence: input.evidence,
        verification: { status: "pending", confidence: 0, issues: [], repaired: false },
    };
    return [
        "Reconstruct the supplied reference video as evidence-grounded JSON for a general-purpose video remake engine.",
        "Infer the actual narrative and visual grammar from the source; do not impose a marketing formula, hook, conflict, reveal, CTA, fixed shot count, or fixed-second cadence.",
        "Create stable typed entity placeholders. Separate identity facts from each entity's behavioral role so identity may later be replaced without changing behavior. Record every visible source-identity noun or short alias in sourceAliases.",
        "Divide the complete timeline only where the evidence shows a semantic event, visual grammar, camera/edit, audio, text, dialogue, rhythm, or state boundary. Preserve the observed timing instead of inventing equal intervals.",
        "For every timeline unit include evidence IDs, exact source start/end seconds, direction, shot index, placeholders, boundary type, adaptive structural invariants, and adaptive continuity facts.",
        `Inspect every universal capability family exactly once per timeline unit: ${UNIVERSAL_CAPABILITY_REGISTRY.map((item) => `${item.family} (${item.inspectFor.join("、")})`).join("; ")}.`,
        "For each family return exactly one coverage status on one line: observed, not-observed, not-applicable, or uncertain. Do not omit a family silently.",
        "Do not turn the capability catalog into required video content. It is an inspection checklist: observed means evidence-backed facts exist; not-observed means inspected but absent; not-applicable means irrelevant; uncertain means evidence is insufficient and guessing is forbidden.",
        "Determine physical instance count for every entity. Explicitly distinguish one physical object shown in multiple views from multiple physical instances; reference-image views never imply extra scene objects.",
        "Audit every visible entity at object level: preserve its exact silhouette, proportions, anatomy, surface material, articulation and viewing orientation. Never replace an observed unusual body or object with a broad category stereotype such as a generic humanoid, product, animal or prop.",
        "Describe each event as an initial state, ordered observable micro-transitions, and terminal state. Use eventFacts as predicate-like evidence claims with participant roles and exact timestamps.",
        "When native video evidence is supplied, use its continuous motion and audio as the primary source for timing, pose changes, paths, contact and release; use storyboards only to cross-check identities, composition and sampled states.",
        "When relevant and observable, inspect orientation, source region, destination region, path, contact, and release in that order; record them as separate concrete event facts instead of vague prose. Mark irrelevant families not-applicable rather than inventing them.",
        "Whenever an object appears, classify the observed origin as hidden-existing, newly generated, deformed-from-source, or separated-from-source. Record topological continuity explicitly: whether it remains attached while extending or moving, and the exact detachment or release moment. Do not collapse an attached extrusion into a separate object falling from the front.",
        "Choose each invariant dimension from the evidence itself. The dimension name and number of invariants are open-ended: keep the smallest set of observable facts that distinguishes this unit from a materially different video.",
        "Do not force motion, anatomy, contact, camera, audio, dialogue, text, lighting, marketing, product display, or any other predetermined dimension when it is absent or irrelevant. Conversely, do not omit an evidence-backed dimension that actually determines similarity in this source.",
        "Mark an invariant critical only when changing it would change the source structure; use supporting for reproducible but non-defining detail. Do not write generic claims such as preserve the style or act naturally.",
        "After assigning placeholders, behavioralRole, direction, structuralInvariants, eventFacts and every continuity fact must refer to entities exclusively by placeholders. Do not repeat source identity nouns there; sourceAliases is the only field allowed to retain those source nouns.",
        "startContinuity and endContinuity may use an empty facts array when the evidence shows no state that must be carried across a boundary.",
        "Omit a safe continuation point unless the source can truly resume there and you can provide observable continuity facts for the next generated segment.",
        "Cover the source continuously from 0 to its exact duration. Describe only observations supported by timestamped evidence. A critical uncertain capability blocks execution; never guess to make the ledger look complete.",
        `Return only a UniversalSourceReconstruction JSON object with schemaVersion ${UNIVERSAL_REMAKE_SCHEMA_VERSION}.`,
        "Use the exact English property names and nesting shown below. Every property is required. Do not translate, rename, omit, or add properties.",
        "Keep property names, enum values, IDs and placeholders in English, but write all human-readable descriptive values in Simplified Chinese, including identityFacts, sourceAliases, behavioralRole, direction, invariant dimensions, event fact dimensions and predicates, coverage reasons, continuity facts and canonicalPrompt.",
        "Do not wrap the object inside result, data, reconstruction, markdown, commentary, or a code fence.",
        "Replace the illustrative text and repeated array items with observations from the supplied evidence. timelineUnits must contain at least one item and continuously cover the full source duration.",
        "Use exactly one allowed enum value wherever the contract shows alternatives separated by |.",
        `Required output contract: ${JSON.stringify(outputContract)}`,
        `Source metadata: ${JSON.stringify({ sourceVideoId: input.sourceVideoId, durationSeconds: input.durationSeconds, aspectRatio: input.aspectRatio })}`,
        `Available evidence: ${JSON.stringify(input.evidence)}`,
    ].join("\n");
}

export async function reconstructUniversalSource(
    input: UniversalReconstructionInput,
    port: UniversalRemakeUnderstandingPort,
): Promise<UniversalSourceReconstruction> {
    validateInput(input);
    let raw = await port.understandVideo({
        phase: "reconstruct",
        prompt: createUniversalReconstructionPrompt(input),
        sourceVideoId: input.sourceVideoId,
        evidence: input.evidence,
    });
    while (true) {
        try {
            return validateUniversalSourceReconstruction(unwrapReconstruction(parseJsonObject(raw)), input);
        } catch (error) {
            const validationMessage = error instanceof Error ? error.message : "未知结构错误";
            const invalidRaw = raw;
            raw = await port.understandVideo({
            phase: "reconstruct",
            prompt: createUniversalReconstructionRepairPrompt(input, invalidRaw, validationMessage),
            sourceVideoId: input.sourceVideoId,
            evidence: input.evidence,
        });
        }
    }
}

function createUniversalReconstructionRepairPrompt(
    input: UniversalReconstructionInput,
    invalidRaw: string | Record<string, unknown>,
    validationMessage: string,
): string {
    return [
        createUniversalReconstructionPrompt(input),
        "The previous reconstruction failed local validation.",
        `Local validation error: ${validationMessage}`,
        "Repair only the schema, evidence grounding, placeholders, adaptive structural invariants, or optional continuity facts identified by that error.",
        "Do not re-plan the video, impose a fixed checklist, add unsupported events, or change evidence-backed timing and identities.",
        "Return the complete corrected reconstruction JSON object, not a patch, explanation, wrapper, markdown, or code fence.",
        `Previous invalid reconstruction: ${serializeRepairInput(invalidRaw)}`,
    ].join("\n");
}

function serializeRepairInput(value: string | Record<string, unknown>): string {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    return serialized.length > 40_000 ? `${serialized.slice(0, 40_000)}…` : serialized;
}

export function validateUniversalSourceReconstruction(
    value: Record<string, unknown>,
    input: UniversalReconstructionInput,
): UniversalSourceReconstruction {
    const modelCandidate = value as unknown as Partial<UniversalSourceReconstruction>;
    const candidate = {
        ...modelCandidate,
        id: modelCandidate.id?.trim() || `reconstruction:${input.sourceVideoId}`,
        sourceVideoId: input.sourceVideoId,
        durationSeconds: input.durationSeconds,
        aspectRatio: input.aspectRatio,
        evidence: input.evidence,
        verification: modelCandidate.verification ?? { status: "pending", confidence: 0, issues: [], repaired: false },
    } as UniversalSourceReconstruction;
    if (Array.isArray(candidate.timelineUnits)) {
        candidate.timelineUnits = candidate.timelineUnits.map((unit) => normalizeTimelineUnitCapabilities(normalizeTimelineUnitContinuity(unit)));
    }
    if (candidate.schemaVersion !== UNIVERSAL_REMAKE_SCHEMA_VERSION) throw new Error("原片重建结果的 schemaVersion 不受支持");
    if (!Array.isArray(candidate.entities) || !Array.isArray(candidate.timelineUnits) || !Array.isArray(candidate.evidence)) throw new Error("原片重建结果缺少实体、时间轴或证据");
    if (!candidate.verification || !["pending", "verified", "repaired", "rejected"].includes(candidate.verification.status)) throw new Error("原片重建结果缺少校验状态");
    const evidenceIds = new Set(input.evidence.map((item) => item.id));
    if (candidate.timelineUnits.some((unit) => !unit.id || !unit.direction || !Array.isArray(unit.evidenceIds) || unit.evidenceIds.some((id) => !evidenceIds.has(id)))) {
        throw new Error("原片重建时间轴引用了无效证据或缺少动作描述");
    }
    if (candidate.timelineUnits.some((unit) => !hasValidStructuralInvariants(unit.structuralInvariants, evidenceIds, unit.placeholderIds))) {
        throw new Error("原片重建缺少有效的自适应结构不变量");
    }
    if (candidate.timelineUnits.some((unit) => !hasValidEventFactsAndCoverage(unit, evidenceIds))) {
        throw new Error("原片重建的通用能力检查不完整、缺少证据，或存在关键不确定项");
    }
    if (candidate.timelineUnits.some((unit) => !hasValidContinuityState(unit.startContinuity, unit.placeholderIds) || !hasValidContinuityState(unit.endContinuity, unit.placeholderIds)
        || !Array.isArray(unit.safeContinuationPoints) || unit.safeContinuationPoints.some((point) => !hasValidContinuityState(point.continuity, unit.placeholderIds)))) {
        throw new Error("原片重建缺少有效的自适应连续性事实");
    }
    if (candidate.entities.some((entity) => !entity.id || !entity.placeholderId || !Array.isArray(entity.sourceAliases) || entity.sourceAliases.some((alias) => typeof alias !== "string" || !alias.trim()) || !entity.behavioralRole || !Number.isInteger(entity.physicalInstanceCount) || entity.physicalInstanceCount < 1 || entity.confidence < 0 || entity.confidence > 1)) {
        throw new Error("原片重建实体字段无效");
    }
    if (!hasContinuousTimeline(candidate.timelineUnits, input.durationSeconds)) {
        throw new Error("原片重建时间轴存在缺口、重叠或未覆盖完整原片");
    }
    return candidate;
}

function normalizeTimelineUnitCapabilities(unit: UniversalTimelineUnit): UniversalTimelineUnit {
    if (!unit || typeof unit !== "object" || !Array.isArray(unit.eventFacts)) return unit;
    const existingCoverage = Array.isArray(unit.capabilityCoverage) ? unit.capabilityCoverage : [];
    const capabilityCoverage = UNIVERSAL_CAPABILITY_REGISTRY.map(({ family }) => {
        const matchingFacts = unit.eventFacts.filter((fact) => fact?.family === family && typeof fact.id === "string" && fact.id.trim());
        const existing = existingCoverage.find((coverage) => coverage?.family === family);
        if (existing?.status === "uncertain" && existing.importance === "critical") {
            return { ...existing, factIds: [] };
        }
        if (matchingFacts.length) {
            return {
                family,
                status: "observed" as const,
                factIds: matchingFacts.map((fact) => fact.id),
                reason: existing?.reason?.trim() || "该维度存在已验证的事件事实",
                importance: matchingFacts.some((fact) => fact.importance === "critical") ? "critical" as const : "supporting" as const,
            };
        }
        const reusableStatus = existing && ["not-observed", "not-applicable", "uncertain"].includes(existing.status)
            ? existing.status
            : "not-observed";
        return {
            family,
            status: reusableStatus,
            factIds: [],
            reason: existing?.reason?.trim() || "本轮证据未形成该维度的可验证事件事实",
            importance: existing?.importance === "critical" ? "critical" as const : "supporting" as const,
        };
    });
    return { ...unit, capabilityCoverage };
}

function hasValidEventFactsAndCoverage(
    unit: UniversalTimelineUnit,
    evidenceIds: Set<string>,
): boolean {
    if (!Array.isArray(unit.eventFacts) || !Array.isArray(unit.capabilityCoverage) || !Array.isArray(unit.placeholderIds)) return false;
    const placeholders = new Set(unit.placeholderIds);
    const factIds = new Set<string>();
    const factById = new Map<string, UniversalTimelineUnit["eventFacts"][number]>();
    for (const fact of unit.eventFacts) {
        if (!fact || typeof fact.id !== "string" || !fact.id.trim() || factIds.has(fact.id)) return false;
        if (!UNIVERSAL_CAPABILITY_FAMILIES.includes(fact.family)) return false;
        if (typeof fact.dimension !== "string" || !fact.dimension.trim() || typeof fact.predicate !== "string" || !fact.predicate.trim()) return false;
        if (!Array.isArray(fact.participantRoles) || fact.participantRoles.some((participant) => !participant
            || typeof participant.placeholderId !== "string" || !placeholders.has(participant.placeholderId)
            || typeof participant.role !== "string" || !participant.role.trim())) return false;
        if (!Number.isFinite(fact.startSeconds) || !Number.isFinite(fact.endSeconds)
            || fact.startSeconds < unit.sourceStartSeconds - 0.001 || fact.endSeconds > unit.sourceEndSeconds + 0.001
            || fact.endSeconds < fact.startSeconds) return false;
        if (!Array.isArray(fact.evidenceIds) || !fact.evidenceIds.length || fact.evidenceIds.some((id) => typeof id !== "string" || !evidenceIds.has(id))) return false;
        if (!['critical', 'supporting'].includes(fact.importance) || !Number.isFinite(fact.confidence) || fact.confidence < 0 || fact.confidence > 1) return false;
        factIds.add(fact.id);
        factById.set(fact.id, fact);
    }
    if (unit.capabilityCoverage.length !== UNIVERSAL_CAPABILITY_FAMILIES.length) return false;
    const seenFamilies = new Set<string>();
    for (const coverage of unit.capabilityCoverage) {
        if (!coverage || !UNIVERSAL_CAPABILITY_FAMILIES.includes(coverage.family) || seenFamilies.has(coverage.family)) return false;
        if (!["observed", "not-observed", "not-applicable", "uncertain"].includes(coverage.status)) return false;
        if (!Array.isArray(coverage.factIds) || typeof coverage.reason !== "string" || !coverage.reason.trim()) return false;
        if (!["critical", "supporting"].includes(coverage.importance)) return false;
        if (coverage.status === "observed") {
            if (!coverage.factIds.length || coverage.factIds.some((id) => factById.get(id)?.family !== coverage.family)) return false;
        } else if (coverage.factIds.length) return false;
        if (coverage.status === "uncertain" && coverage.importance === "critical") return false;
        seenFamilies.add(coverage.family);
    }
    return factById.size === factIds.size && [...factById.keys()].every((id) => unit.capabilityCoverage.some((coverage) => coverage.status === "observed" && coverage.factIds.includes(id)));
}

function hasContinuousTimeline(units: UniversalTimelineUnit[], durationSeconds: number): boolean {
    if (!units.length) return false;
    const epsilon = 0.01;
    if (Math.abs(units[0].sourceStartSeconds) > epsilon) return false;
    for (let index = 0; index < units.length; index += 1) {
        const unit = units[index];
        if (!Number.isFinite(unit.sourceStartSeconds) || !Number.isFinite(unit.sourceEndSeconds) || unit.sourceEndSeconds <= unit.sourceStartSeconds) return false;
        if (index > 0 && Math.abs(units[index - 1].sourceEndSeconds - unit.sourceStartSeconds) > epsilon) return false;
    }
    return Math.abs(units[units.length - 1].sourceEndSeconds - durationSeconds) <= epsilon;
}

function hasValidStructuralInvariants(
    value: UniversalSourceReconstruction["timelineUnits"][number]["structuralInvariants"],
    evidenceIds: Set<string>,
    unitPlaceholderIds: string[],
): boolean {
    if (!Array.isArray(value) || !value.length || !Array.isArray(unitPlaceholderIds)) return false;
    const placeholders = new Set(unitPlaceholderIds);
    return value.every((invariant) => Boolean(invariant)
        && typeof invariant.id === "string" && invariant.id.trim().length > 0
        && typeof invariant.dimension === "string" && invariant.dimension.trim().length > 0
        && typeof invariant.description === "string" && invariant.description.trim().length > 0
        && Array.isArray(invariant.participantPlaceholderIds)
        && invariant.participantPlaceholderIds.every((id) => typeof id === "string" && placeholders.has(id))
        && Array.isArray(invariant.evidenceIds) && invariant.evidenceIds.length > 0
        && invariant.evidenceIds.every((id) => typeof id === "string" && evidenceIds.has(id))
        && ["critical", "supporting"].includes(invariant.importance)
        && Number.isFinite(invariant.confidence) && invariant.confidence >= 0 && invariant.confidence <= 1);
}

function hasValidContinuityState(
    value: UniversalSourceReconstruction["timelineUnits"][number]["startContinuity"],
    unitPlaceholderIds: string[],
): boolean {
    if (!value || !Array.isArray(value.facts) || !Array.isArray(unitPlaceholderIds)) return false;
    const placeholders = new Set(unitPlaceholderIds);
    return value.facts.every((fact) => Boolean(fact)
        && typeof fact.dimension === "string" && fact.dimension.trim().length > 0
        && typeof fact.description === "string" && fact.description.trim().length > 0
        && Array.isArray(fact.participantPlaceholderIds)
        && fact.participantPlaceholderIds.every((id) => typeof id === "string" && placeholders.has(id)));
}

function normalizeTimelineUnitContinuity(unit: UniversalTimelineUnit): UniversalTimelineUnit {
    if (!unit || typeof unit !== "object") return unit;
    const placeholderIds = Array.isArray(unit.placeholderIds) ? unit.placeholderIds.filter((id) => typeof id === "string") : [];
    const safeContinuationPoints = Array.isArray(unit.safeContinuationPoints)
        ? unit.safeContinuationPoints.flatMap((point) => {
            if (!point || typeof point !== "object" || !Number.isFinite(point.atSeconds)) return [];
            const continuity = normalizeContinuityState(point.continuity, placeholderIds);
            return continuity.facts.length ? [{ ...point, continuity }] : [];
        })
        : [];
    return {
        ...unit,
        placeholderIds,
        startContinuity: normalizeContinuityState(unit.startContinuity, placeholderIds),
        endContinuity: normalizeContinuityState(unit.endContinuity, placeholderIds),
        safeContinuationPoints,
    };
}

function normalizeContinuityState(value: unknown, unitPlaceholderIds: string[]): UniversalContinuityState {
    if (!isRecord(value)) return { facts: [] };
    const placeholders = new Set(unitPlaceholderIds);
    if (Array.isArray(value.facts)) {
        const facts = value.facts.flatMap((entry) => {
            if (!isRecord(entry) || typeof entry.dimension !== "string" || !entry.dimension.trim() || typeof entry.description !== "string" || !entry.description.trim()) return [];
            const participantPlaceholderIds = Array.isArray(entry.participantPlaceholderIds)
                ? entry.participantPlaceholderIds.filter((id): id is string => typeof id === "string" && placeholders.has(id))
                : [];
            return [{ dimension: entry.dimension.trim(), description: entry.description.trim(), participantPlaceholderIds }];
        });
        return { facts };
    }
    const facts = Object.entries(value).flatMap(([dimension, description]) => typeof description === "string" && description.trim()
        ? [{ dimension, description: description.trim(), participantPlaceholderIds: [] }]
        : []);
    return { facts };
}

export function parseJsonObject(raw: string | Record<string, unknown>): Record<string, unknown> {
    if (typeof raw !== "string") return raw;
    const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const parsed: unknown = JSON.parse(trimmed);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("视频理解模型没有返回 JSON 对象");
    return parsed as Record<string, unknown>;
}

function unwrapReconstruction(value: Record<string, unknown>): Record<string, unknown> {
    if (isRecord(value.reconstruction)) return value.reconstruction;
    return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && !Array.isArray(value) && typeof value === "object";
}

function validateInput(input: UniversalReconstructionInput): void {
    if (!input.sourceVideoId.trim()) throw new Error("缺少参考视频 ID");
    if (!Number.isFinite(input.durationSeconds) || input.durationSeconds <= 0) throw new Error("参考视频时长无效");
    if (!input.aspectRatio.trim()) throw new Error("参考视频画幅无效");
    if (!Array.isArray(input.evidence) || !input.evidence.length) throw new Error("参考视频尚未形成可复核证据");
}
