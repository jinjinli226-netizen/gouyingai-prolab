export const UNIVERSAL_REMAKE_SCHEMA_VERSION = 3 as const;

export type UniversalRemakeSchemaVersion = typeof UNIVERSAL_REMAKE_SCHEMA_VERSION;

export type UniversalBoundaryKind = "hard-cut" | "transition" | "semantic" | "continuous" | "none";

export type UniversalCoverageStatus = "observed" | "not-observed" | "not-applicable" | "uncertain";

export type UniversalCapabilityFamily =
    | "entity-identity"
    | "temporal-boundary"
    | "spatial-geometry"
    | "pose-deformation"
    | "motion-path"
    | "relation-contact"
    | "state-transition"
    | "camera-edit"
    | "scene-treatment"
    | "text-audio";

export type UniversalEventParticipant = {
    placeholderId: string;
    role: string;
};

export type UniversalEventFact = {
    id: string;
    family: UniversalCapabilityFamily;
    dimension: string;
    predicate: string;
    participantRoles: UniversalEventParticipant[];
    startSeconds: number;
    endSeconds: number;
    evidenceIds: string[];
    importance: "critical" | "supporting";
    confidence: number;
    beforeState?: string;
    afterState?: string;
};

export type UniversalCapabilityCoverage = {
    family: UniversalCapabilityFamily;
    status: UniversalCoverageStatus;
    factIds: string[];
    reason: string;
    importance: "critical" | "supporting";
};

export type UniversalContinuityFact = {
    dimension: string;
    description: string;
    participantPlaceholderIds: string[];
};

export type UniversalContinuityState = {
    facts: UniversalContinuityFact[];
};

export type UniversalSafeContinuationPoint = {
    atSeconds: number;
    continuity: UniversalContinuityState;
};

export type UniversalStructuralInvariant = {
    id: string;
    dimension: string;
    description: string;
    participantPlaceholderIds: string[];
    evidenceIds: string[];
    importance: "critical" | "supporting";
    confidence: number;
};

export type UniversalTimelineUnit = {
    id: string;
    sourceStartSeconds: number;
    sourceEndSeconds: number;
    parentShotIndex: number;
    direction: string;
    structuralInvariants: UniversalStructuralInvariant[];
    eventFacts: UniversalEventFact[];
    capabilityCoverage: UniversalCapabilityCoverage[];
    placeholderIds: string[];
    evidenceIds: string[];
    boundaryAfter: UniversalBoundaryKind;
    safeContinuationPoints: UniversalSafeContinuationPoint[];
    startContinuity: UniversalContinuityState;
    endContinuity: UniversalContinuityState;
};

export type UniversalSourceEntity = {
    id: string;
    placeholderId: string;
    kind: "product" | "person" | "scene" | "vehicle" | "wardrobe" | "animal" | "prop" | "other";
    identityFacts: string;
    sourceAliases: string[];
    behavioralRole: string;
    physicalInstanceCount: number;
    evidenceIds: string[];
    confidence: number;
};

export type UniversalSourceEvidence = {
    id: string;
    atSeconds: number;
    kind: "video" | "frame" | "audio" | "text";
    artifactId?: string;
    description: string;
};

export type UniversalReconstructionVerification = {
    status: "pending" | "verified" | "repaired" | "rejected";
    confidence: number;
    issues: string[];
    repaired: boolean;
};

export type UniversalSourceReconstruction = {
    schemaVersion: UniversalRemakeSchemaVersion;
    id: string;
    sourceVideoId: string;
    durationSeconds: number;
    aspectRatio: string;
    entities: UniversalSourceEntity[];
    timelineUnits: UniversalTimelineUnit[];
    canonicalPrompt: string;
    evidence: UniversalSourceEvidence[];
    verification: UniversalReconstructionVerification;
};

export type UniversalReplacementEntity = {
    id: string;
    kind: UniversalSourceEntity["kind"];
    identityFacts: string;
    referenceAssetIds: string[];
    confidence: number;
};

export type UniversalEntityBinding = {
    placeholderId: string;
    sourceEntityId: string;
    replacementEntityId?: string;
    status: "source-only" | "auto-bound" | "user-confirmed" | "ambiguous";
};

export type UniversalBindingResolution = {
    status: "ready" | "needs-confirmation";
    bindings: UniversalEntityBinding[];
    issues: string[];
};

export type UniversalPromptPatch = {
    id: string;
    reason: "explicit-user-change";
    timelineUnitId: string;
    beforeDirection: string;
    afterDirection: string;
};

export type UniversalCompiledEntity = {
    placeholderId: string;
    sourceEntityId: string;
    replacementEntityId?: string;
    kind: UniversalSourceEntity["kind"];
    identityFacts: string;
    sourceAliases: string[];
    behavioralRole: string;
    physicalInstanceCount: number;
    referenceAssetIds: string[];
};

export type UniversalBoundTemplate = {
    schemaVersion: UniversalRemakeSchemaVersion;
    reconstructionId: string;
    durationSeconds: number;
    aspectRatio: string;
    entityManifest: UniversalCompiledEntity[];
    bindings: UniversalEntityBinding[];
    timelineUnits: UniversalTimelineUnit[];
    canonicalPrompt: string;
};

export type UniversalPromptDifference = {
    kind: "entity-binding" | "explicit-patch" | "timeline-order" | "timeline-timing" | "timeline-direction" | "continuity" | "timeline-structure" | "event-fact" | "capability-coverage";
    timelineUnitId?: string;
    summary: string;
};

export type UniversalFidelityReport = {
    passed: boolean;
    allowedChanges: UniversalPromptDifference[];
    forbiddenChanges: UniversalPromptDifference[];
};

export type UniversalReadySegmentPlan = Extract<UniversalSegmentPlan, { status: "ready" }>;

export type UniversalRemakeTemplate = UniversalBoundTemplate & {
    id: string;
    segmentPlan: UniversalReadySegmentPlan;
    fidelity: UniversalFidelityReport;
    patches: UniversalPromptPatch[];
    compiledPromptPreview?: string;
    directorPromptPlan?: UniversalDirectorPromptPlan;
    sourceVisualReferences?: UniversalSourceVisualReference[];
};

export type UniversalSourceVisualReference = {
    assetId: string;
    kind: "storyboard" | "anchor";
    atSeconds?: number;
};

export type UniversalDirectorPromptSegment = {
    index: number;
    roleLabels: Record<string, string>;
    promptTemplate: string;
    coveredFactIds: string[];
    targetTerminalState: string;
};

export type UniversalDirectorPromptPlan = {
    segments: UniversalDirectorPromptSegment[];
};

export type UniversalVideoModelCapabilities = {
    modelId: string;
    maxDurationSeconds: number;
    supportsContinuationFrame: boolean;
    generatesAudio: boolean;
};

export type UniversalVariableOption = {
    id: string;
    identityFacts: string;
    referenceAssetIds: string[];
};

export type UniversalVariableSlot = {
    id: string;
    targetPlaceholderId: string;
    options: UniversalVariableOption[];
};

export type UniversalBatchRecipe = {
    count?: number;
    seed: number;
    variableSlots: UniversalVariableSlot[];
};

export type UniversalSegmentRequest = {
    id: string;
    index: number;
    prompt: string;
    durationSeconds: number;
    sourceStartSeconds: number;
    sourceEndSeconds: number;
    aspectRatio: string;
    modelId: string;
    referenceAssetIds: string[];
    timelineUnitIds: string[];
    continuationFrameFromSegmentId?: string;
};

export type UniversalCandidateOutput =
    | { kind: "direct-video"; sourceSegmentId: string; targetDurationSeconds: number }
    | {
        kind: "composed-video";
        orderedSegmentIds: string[];
        boundaryKinds: UniversalBoundaryKind[];
        targetDurationSeconds: number;
        aspectRatio: string;
        audioPolicy: "segment-native";
    };

export type UniversalCandidateManifest = {
    id: string;
    index: number;
    templateId: string;
    seed: number;
    slotSelections: Record<string, string>;
    entityManifest: UniversalCompiledEntity[];
    bindings: UniversalEntityBinding[];
    segments: UniversalSegmentRequest[];
    output: UniversalCandidateOutput;
    totalGeneratedSeconds: number;
};

export type UniversalBatchSummary = {
    candidateCount: number;
    segmentCallCount: number;
    compositionCallCount: number;
    totalGeneratedSeconds: number;
};

export type UniversalGenerationSegment = {
    id: string;
    index: number;
    sourceStartSeconds: number;
    sourceEndSeconds: number;
    durationSeconds: number;
    timelineUnitIds: string[];
    boundaryAfter: UniversalBoundaryKind;
    continuityIn: UniversalContinuityState;
    continuityOut: UniversalContinuityState;
};

export type UniversalSegmentPlan =
    | { status: "ready"; maxDurationSeconds: number; segments: UniversalGenerationSegment[]; issues: [] }
    | { status: "needs-refinement"; maxDurationSeconds: number; segments: []; issues: string[] };

export type UniversalReconstructionInput = {
    sourceVideoId: string;
    durationSeconds: number;
    aspectRatio: string;
    evidence: UniversalSourceEvidence[];
};

export type UniversalUnderstandingRequest = {
    phase: "reconstruct" | "verify";
    prompt: string;
    sourceVideoId: string;
    evidence: UniversalSourceEvidence[];
    reconstruction?: UniversalSourceReconstruction;
};

export type UniversalRemakeUnderstandingPort = {
    understandVideo(request: UniversalUnderstandingRequest): Promise<string | Record<string, unknown>>;
};

export type UniversalRemakePreparationInput = {
    source: UniversalReconstructionInput;
    replacements: UniversalReplacementEntity[];
    explicitBindings: Array<{ sourceEntityId: string; replacementEntityId: string }>;
    patches: UniversalPromptPatch[];
    recipe: UniversalBatchRecipe;
    capabilities: UniversalVideoModelCapabilities;
};

export type UniversalRemakePreparation =
    | { status: "needs-confirmation"; reconstruction: UniversalSourceReconstruction; issues: string[] }
    | { status: "needs-refinement"; reconstruction: UniversalSourceReconstruction; issues: string[] }
    | {
        status: "ready";
        reconstruction: UniversalSourceReconstruction;
        template: UniversalRemakeTemplate;
        candidates: UniversalCandidateManifest[];
        summary: UniversalBatchSummary;
    };
