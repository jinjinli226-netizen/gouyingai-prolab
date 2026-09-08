export type UniversalCompositionBoundary = "hard-cut" | "transition" | "semantic" | "continuous" | "none";
export type UniversalCompositionSegment = {
    id: string;
    artifactUri: string;
    durationSeconds: number;
    boundaryAfter: UniversalCompositionBoundary;
    hasAudio: boolean;
};
export type UniversalCompositionInput = {
    userId: string;
    canvasId: string;
    candidateId: string;
    targetDurationSeconds: number;
    aspectRatio: string;
    width: number;
    height: number;
    fps: number;
    sampleRate: number;
    segments: UniversalCompositionSegment[];
};
export type UniversalResolvedArtifact = {
    filePath: string;
    mimeType: string;
};
export type UniversalArtifactResolver = (request: {
    userId: string;
    canvasId: string;
    uri: string;
}) => Promise<UniversalResolvedArtifact | null>;
export type UniversalCompositionPlan = {
    mode: "concat" | "transition";
    targetDurationSeconds: number;
    width: number;
    height: number;
    fps: number;
    sampleRate: number;
    inputs: Array<UniversalCompositionSegment & UniversalResolvedArtifact>;
    transitions: Array<{
        afterSegmentIndex: number;
        durationSeconds: number;
    }>;
};
export type UniversalProcessResult = {
    exitCode: number;
    stderr: string;
};
export type UniversalProcessRunner = (command: string, args: string[]) => Promise<UniversalProcessResult>;
export type UniversalRunStatus = "queued" | "running" | "paused" | "completed" | "failed" | "cancelled";
export type UniversalCandidateStatus = "queued" | "running" | "composing" | "evaluating" | "succeeded" | "fidelity-failed" | "failed" | "cancelled";
export type UniversalCandidateFidelityStatus = "not-evaluated" | "pending" | "passed" | "failed";
export type UniversalFidelityImportance = "critical" | "supporting";
export type UniversalFidelityContract = {
    schemaVersion: number;
    durationSeconds: number;
    aspectRatio: string;
    canonicalPrompt: string;
    timelineUnits: Array<{
        id: string;
        sourceStartSeconds: number;
        sourceEndSeconds: number;
        direction: string;
        structuralInvariants: Array<{
            id: string;
            dimension: string;
            description: string;
            importance: UniversalFidelityImportance;
        }>;
        eventFacts: Array<{
            id: string;
            family: string;
            dimension: string;
            predicate: string;
            startSeconds: number;
            endSeconds: number;
            importance: UniversalFidelityImportance;
        }>;
        startContinuity: {
            facts: Array<{
                dimension: string;
                description: string;
                participantPlaceholderIds: string[];
            }>;
        };
        endContinuity: {
            facts: Array<{
                dimension: string;
                description: string;
                participantPlaceholderIds: string[];
            }>;
        };
    }>;
};
export type UniversalFidelityFact = {
    id: string;
    kind: "structural-invariant" | "event-fact" | "start-continuity" | "end-continuity" | "entity";
    importance: UniversalFidelityImportance;
    description: string;
    timelineUnitId?: string;
    startSeconds?: number;
    endSeconds?: number;
};
export type UniversalFidelityEvaluation = {
    passed: boolean;
    score: number;
    threshold: number;
    matchedFactIds: string[];
    missingFactIds: string[];
    issues: string[];
    factResults: Array<UniversalFidelityFact & {
        status: "matched" | "missing" | "contradicted" | "uncertain";
        issue: string;
    }>;
};
export type UniversalRunSegmentManifest = {
    id: string;
    index: number;
    prompt: string;
    durationSeconds: number;
    modelId: string;
    referenceAssetIds: string[];
    maxReferenceImages?: number;
    [key: string]: unknown;
};
export type UniversalRunCandidateManifest = {
    id: string;
    index: number;
    segments: UniversalRunSegmentManifest[];
    output: Record<string, unknown> & {
        kind: "direct-video" | "composed-video";
    };
    entityManifest?: Array<{
        placeholderId: string;
        identityFacts: string;
        physicalInstanceCount: number;
        [key: string]: unknown;
    }>;
    [key: string]: unknown;
};
export type UniversalRunCandidate = {
    index: number;
    manifest: UniversalRunCandidateManifest;
    status: UniversalCandidateStatus;
    segment_job_ids: string[];
    segment_artifact_uris: string[];
    continuation_frame_artifact_uris: Array<string | null>;
    output_artifact_uri: string | null;
    failure_stage: "segment" | "composition" | "fidelity" | null;
    error: string | null;
    composition_attempt: number;
    generation_retry_count: number;
    fidelity_status: UniversalCandidateFidelityStatus;
    fidelity_job_id: string | null;
    fidelity_score: number | null;
    fidelity_attempt: number;
    fidelity_issues: string[];
    fidelity_matched_fact_ids: string[];
    fidelity_missing_fact_ids: string[];
    corrected_retry_prompt: string | null;
    updated_at: string;
};
export type UniversalRemakeRun = {
    id: string;
    user_id: string;
    canvas_id: string;
    target_node_id: string;
    generation_revision: number;
    client_request_id: string;
    template_id: string;
    model_id: string | null;
    channel_id: string | null;
    fidelity_model_id: string;
    fidelity_channel_id: string;
    source_video_artifact_uri: string;
    source_reference_asset_ids: string[];
    fidelity_contract: UniversalFidelityContract;
    fidelity_threshold: number;
    max_fidelity_retries: number;
    max_in_flight: number;
    status: UniversalRunStatus;
    candidates: UniversalRunCandidate[];
    succeeded_count: number;
    failed_count: number;
    cancelled_count: number;
    created_at: string;
    updated_at: string;
    finished_at: string | null;
};
export type UniversalRemakeRunCreateInput = Pick<UniversalRemakeRun, "canvas_id" | "target_node_id" | "generation_revision" | "client_request_id" | "template_id" | "model_id" | "channel_id" | "max_in_flight"> & Partial<Pick<UniversalRemakeRun, "fidelity_model_id" | "fidelity_channel_id" | "source_video_artifact_uri" | "source_reference_asset_ids" | "fidelity_contract" | "fidelity_threshold" | "max_fidelity_retries">> & {
    candidates: UniversalRunCandidateManifest[];
};
export type UniversalRemakeRunRepository = {
    create(userId: string, input: UniversalRemakeRunCreateInput): Promise<UniversalRemakeRun>;
    get(userId: string, runId: string): Promise<UniversalRemakeRun | null>;
    getInternal(runId: string): Promise<UniversalRemakeRun | null>;
    list(userId: string, canvasId?: string): Promise<UniversalRemakeRun[]>;
    listActive(): Promise<UniversalRemakeRun[]>;
    update(runId: string, patch: Partial<UniversalRemakeRun>): Promise<UniversalRemakeRun | null>;
    updateCandidate(runId: string, candidateIndex: number, patch: Partial<UniversalRunCandidate>): Promise<UniversalRemakeRun | null>;
};
