export const VIRAL_VIDEO_DOMAIN_SCHEMA_VERSION = 1 as const;

export type ViralVideoDomainSchemaVersion = typeof VIRAL_VIDEO_DOMAIN_SCHEMA_VERSION;
export type ViralEventPriority = "P0" | "P1" | "P2";
export type ViralObjectKind = "product" | "person" | "scene" | "vehicle" | "wardrobe" | "animal" | "prop";
export type ViralObjectOrigin = "source-video" | "uploaded-reference";
export type ViralObjectRole = "hero-product" | "supporting-object" | "character" | "environment";
export type ViralBindingMode = "auto" | "user-confirmed" | "user-created";
export type ViralBindingStatus = "bound" | "suggested" | "needs-confirmation" | "conflict";
export type ViralEventFunction = "hook" | "spectacle" | "reveal" | "product_proof" | "cta" | "transition" | "context" | "other";
export type ViralCandidateStatus = "compiled" | "queued" | "running" | "completed" | "failed" | "canceled";

export type ViralVersionedRecord = {
    schemaVersion: ViralVideoDomainSchemaVersion;
    id: string;
};

export type ViralSourceEvidence = ViralVersionedRecord & {
    kind: "frame" | "audio" | "subtitle" | "transcript";
    startSeconds: number;
    endSeconds?: number;
    assetId?: string;
    description: string;
    confidence: number;
};

export type ViralObjectFingerprint = ViralVersionedRecord & {
    origin: ViralObjectOrigin;
    kind: ViralObjectKind;
    name: string;
    role: ViralObjectRole;
    visualFacts: {
        colors: string[];
        materials: string[];
        shape: string;
        markings: string[];
        packaging: string;
        distinctiveFeatures: string[];
    };
    functionalFacts: string[];
    shotIndexes: number[];
    referenceAssetIds: string[];
    representativeFrameIds: string[];
    confidence: number;
};

export type ViralReplacementBinding = ViralVersionedRecord & {
    sourceObjectId: string;
    replacementObjectId: string;
    mode: ViralBindingMode;
    status: ViralBindingStatus;
    confidence: number;
    reason: string;
    affectedEventIds: string[];
};

export type ViralMustKeepEvent = ViralVersionedRecord & {
    priority: ViralEventPriority;
    function: ViralEventFunction;
    sourceStartSeconds: number;
    sourceEndSeconds: number;
    targetStartSeconds: number;
    targetEndSeconds: number;
    parentShotIndex: number;
    description: string;
    startState: string;
    endState: string;
    involvedObjectIds: string[];
    audioCue: string;
    evidenceIds: string[];
};

export type ViralCharacterBible = {
    characters: Array<{
        objectId: string;
        identityFacts: string[];
        performanceRules: string[];
    }>;
};

export type ViralWardrobeStage = {
    objectId: string;
    startSeconds: number;
    endSeconds: number;
    visibleFacts: string[];
};

export type ViralExecutionBeat = {
    id: string;
    sourceEventId: string;
    startSeconds: number;
    endSeconds: number;
    visualAction: string;
    cameraIntent: string;
    continuityAnchors: string[];
};

export type ViralAudioPlan = {
    voiceover: Array<{ startSeconds: number; endSeconds: number; text: string }>;
    subtitles: Array<{ startSeconds: number; endSeconds: number; text: string }>;
    soundEffects: Array<{ startSeconds: number; cue: string }>;
    music: Array<{ startSeconds: number; endSeconds: number; description: string }>;
};

export type ViralCoverageReport = ViralVersionedRecord & {
    sourceEventCount: number;
    mappedEventCount: number;
    p0Count: number;
    mappedP0Count: number;
    sourceSceneCount: number;
    mappedSceneCount: number;
    sourceDialogueCount: number;
    mappedDialogueCount: number;
    missingEventIds: string[];
    missingP0EventIds: string[];
    passed: boolean;
    issues: string[];
};

export type ViralRemakeTemplate = ViralVersionedRecord & {
    title: string;
    sourceDurationSeconds: number;
    targetDurationSeconds: number;
    aspectRatio: string;
    hookMechanism: string;
    narrativeStructure: string;
    objects: ViralObjectFingerprint[];
    bindings: ViralReplacementBinding[];
    characterBible: ViralCharacterBible;
    wardrobeTimeline: ViralWardrobeStage[];
    events: ViralMustKeepEvent[];
    beats: ViralExecutionBeat[];
    audioPlan: ViralAudioPlan;
    continuityRules: string[];
    coverage: ViralCoverageReport;
};

export type ViralVariableSlot = {
    id: string;
    label: string;
    values: string[];
};

export type ViralBatchRecipe = ViralVersionedRecord & {
    candidateCount: number;
    seed: number;
    fixedObjectIds: string[];
    variableSlots: ViralVariableSlot[];
    pilotCount: number;
    autoContinueAfterPilot: boolean;
    maxQualityRetries: number;
};

export type ViralCandidateManifest = ViralVersionedRecord & {
    index: number;
    templateId: string;
    seed: number;
    slotSelections: Record<string, string>;
    fixedBindings: ViralReplacementBinding[];
    prompt: string;
    status: ViralCandidateStatus;
};

export type ViralQualityReport = ViralVersionedRecord & {
    candidateId: string;
    totalScore: number;
    eventCoverageScore: number;
    timelineScore: number;
    identityScore: number;
    productScore: number;
    audioScore: number;
    visualScore: number;
    missingP0EventIds: string[];
    issues: string[];
    evidence: ViralSourceEvidence[];
    decision: "pass" | "retry" | "review";
};

export type ViralDomainRecordMap = {
    object: ViralObjectFingerprint;
    binding: ViralReplacementBinding;
    event: ViralMustKeepEvent;
    template: ViralRemakeTemplate;
    recipe: ViralBatchRecipe;
    candidate: ViralCandidateManifest;
    coverage: ViralCoverageReport;
    quality: ViralQualityReport;
};

export type ViralDomainRecordKind = keyof ViralDomainRecordMap;

export function normalizeViralCandidateCount(value?: number): number {
    if (!Number.isFinite(value)) return 1;
    return Math.max(1, Math.min(1000, Math.floor(value!)));
}

export function createViralBatchRecipe(input: Partial<Omit<ViralBatchRecipe, "schemaVersion">> = {}): ViralBatchRecipe {
    return {
        schemaVersion: VIRAL_VIDEO_DOMAIN_SCHEMA_VERSION,
        id: input.id?.trim() || createViralDomainId("recipe"),
        candidateCount: normalizeViralCandidateCount(input.candidateCount),
        seed: Number.isFinite(input.seed) ? Math.floor(input.seed!) : 1,
        fixedObjectIds: input.fixedObjectIds ? [...input.fixedObjectIds] : [],
        variableSlots: input.variableSlots ? input.variableSlots.map((slot) => ({ ...slot, values: [...slot.values] })) : [],
        pilotCount: normalizeNonNegativeInteger(input.pilotCount),
        autoContinueAfterPilot: input.autoContinueAfterPilot === true,
        maxQualityRetries: normalizeNonNegativeInteger(input.maxQualityRetries),
    };
}

export function validateViralDomainRecord<K extends ViralDomainRecordKind>(kind: K, value: unknown): ViralDomainRecordMap[K] {
    const record = requireRecord(value, kind);
    validateVersionedRecord(record);
    const validators: Record<ViralDomainRecordKind, (candidate: Record<string, unknown>) => void> = {
        object: validateObjectFingerprint,
        binding: validateReplacementBinding,
        event: validateMustKeepEvent,
        template: validateRemakeTemplate,
        recipe: validateBatchRecipe,
        candidate: validateCandidateManifest,
        coverage: validateCoverageReport,
        quality: validateQualityReport,
    };
    validators[kind](record);
    return value as ViralDomainRecordMap[K];
}

function createViralDomainId(prefix: string): string {
    const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return `${prefix}-${suffix}`;
}

function normalizeNonNegativeInteger(value?: number): number {
    return Number.isFinite(value) ? Math.max(0, Math.floor(value!)) : 0;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
    return value as Record<string, unknown>;
}

function validateVersionedRecord(record: Record<string, unknown>): void {
    if (record.schemaVersion !== VIRAL_VIDEO_DOMAIN_SCHEMA_VERSION) throw new Error("unsupported schemaVersion");
    if (typeof record.id !== "string" || !record.id.trim()) throw new Error("id must be a non-empty string");
}

function requireString(record: Record<string, unknown>, field: string): void {
    if (typeof record[field] !== "string") throw new Error(`${field} must be a string`);
}

function requireArray(record: Record<string, unknown>, field: string): void {
    if (!Array.isArray(record[field])) throw new Error(`${field} must be an array`);
}

function requireNumber(record: Record<string, unknown>, field: string, min = 0, max = Number.POSITIVE_INFINITY): void {
    const value = record[field];
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error(`${field} must be between ${min} and ${max}`);
}

function validateObjectFingerprint(record: Record<string, unknown>): void {
    requireString(record, "name");
    requireArray(record, "functionalFacts");
    requireArray(record, "shotIndexes");
    requireArray(record, "referenceAssetIds");
    requireArray(record, "representativeFrameIds");
    requireNumber(record, "confidence", 0, 1);
    const facts = requireRecord(record.visualFacts, "visualFacts");
    ["colors", "materials", "markings", "distinctiveFeatures"].forEach((field) => requireArray(facts, field));
    requireString(facts, "shape");
    requireString(facts, "packaging");
}

function validateReplacementBinding(record: Record<string, unknown>): void {
    requireString(record, "sourceObjectId");
    requireString(record, "replacementObjectId");
    requireString(record, "reason");
    requireArray(record, "affectedEventIds");
    requireNumber(record, "confidence", 0, 1);
}

function validateMustKeepEvent(record: Record<string, unknown>): void {
    ["sourceStartSeconds", "sourceEndSeconds", "targetStartSeconds", "targetEndSeconds"].forEach((field) => requireNumber(record, field));
    if ((record.sourceEndSeconds as number) <= (record.sourceStartSeconds as number)) throw new Error("source event duration must be positive");
    if ((record.targetEndSeconds as number) <= (record.targetStartSeconds as number)) throw new Error("target event duration must be positive");
    requireNumber(record, "parentShotIndex", 1);
    ["description", "startState", "endState", "audioCue"].forEach((field) => requireString(record, field));
    requireArray(record, "involvedObjectIds");
    requireArray(record, "evidenceIds");
}

function validateRemakeTemplate(record: Record<string, unknown>): void {
    ["title", "aspectRatio", "hookMechanism", "narrativeStructure"].forEach((field) => requireString(record, field));
    requireNumber(record, "sourceDurationSeconds", Number.EPSILON);
    requireNumber(record, "targetDurationSeconds", Number.EPSILON);
    ["objects", "bindings", "wardrobeTimeline", "events", "beats", "continuityRules"].forEach((field) => requireArray(record, field));
    requireRecord(record.characterBible, "characterBible");
    requireRecord(record.audioPlan, "audioPlan");
    validateViralDomainRecord("coverage", record.coverage);
}

function validateBatchRecipe(record: Record<string, unknown>): void {
    requireNumber(record, "candidateCount", 1, 1000);
    requireNumber(record, "seed", Number.NEGATIVE_INFINITY);
    requireNumber(record, "pilotCount");
    requireNumber(record, "maxQualityRetries");
    requireArray(record, "fixedObjectIds");
    requireArray(record, "variableSlots");
    if (typeof record.autoContinueAfterPilot !== "boolean") throw new Error("autoContinueAfterPilot must be a boolean");
}

function validateCandidateManifest(record: Record<string, unknown>): void {
    requireNumber(record, "index");
    requireNumber(record, "seed", Number.NEGATIVE_INFINITY);
    requireString(record, "templateId");
    requireString(record, "prompt");
    requireRecord(record.slotSelections, "slotSelections");
    requireArray(record, "fixedBindings");
}

function validateCoverageReport(record: Record<string, unknown>): void {
    ["sourceEventCount", "mappedEventCount", "p0Count", "mappedP0Count", "sourceSceneCount", "mappedSceneCount", "sourceDialogueCount", "mappedDialogueCount"].forEach((field) => requireNumber(record, field));
    ["missingEventIds", "missingP0EventIds", "issues"].forEach((field) => requireArray(record, field));
    if (typeof record.passed !== "boolean") throw new Error("passed must be a boolean");
}

function validateQualityReport(record: Record<string, unknown>): void {
    requireString(record, "candidateId");
    ["totalScore", "eventCoverageScore", "timelineScore", "identityScore", "productScore", "audioScore", "visualScore"].forEach((field) => requireNumber(record, field, 0, 100));
    ["missingP0EventIds", "issues", "evidence"].forEach((field) => requireArray(record, field));
}
