export type ApiFormat = "openai" | "gemini" | "autodl_comfyui";

export type Channel = {
    id: string;
    name: string;
    base_url: string;
    api_format: ApiFormat;
    key_ciphertext: string;
    enabled: boolean;
};

export type Model = {
    id: string;
    channel_id: string;
    model_name: string;
    display_name: string;
    capability: "image" | "video" | "text" | "audio";
    api_format: ApiFormat;
    published: boolean;
    sort_order: number;
    options: Record<string, unknown>;
};

export type PublicModel = {
    id: string;
    bindingId: string;
    modelName: string;
    displayName: string;
    capability: Model["capability"];
    options: Record<string, unknown>;
    channelName?: string;
    channelBaseUrl?: string;
    channelId?: string;
};

export type GatewayTask = {
    task_id: string;
    user_id: string;
    channel_id: string;
    model_id: string;
    upstream_task_id: string;
    capability: string;
};

export type CanvasArtifact = {
    id: string;
    user_id: string;
    canvas_id: string;
    uri: string;
    file_path: string;
    name: string;
    mime_type: string;
    bytes: number;
    checksum: string;
    created_at: string;
};

export type CanvasJobKind = "text" | "image" | "video" | "audio" | "viral-analysis" | "viral-plan" | "viral-video" | "viral-quality";

export type CanvasJobStatus = "queued" | "leased" | "submitting" | "running" | "succeeded" | "failed" | "cancel_requested" | "cancelled";

export type CanvasJobResultPatch = {
    canvasId: string;
    nodeId: string;
    jobId: string;
    generationRevision: number;
    nodePatch: Record<string, unknown>;
    workflowPatch?: Record<string, unknown>;
};

export type CanvasJob = {
    id: string;
    user_id: string;
    canvas_id: string;
    parent_job_id: string | null;
    batch_id: string | null;
    candidate_index: number | null;
    target_node_id: string;
    generation_revision: number;
    client_request_id: string;
    kind: CanvasJobKind;
    status: CanvasJobStatus;
    model_id: string | null;
    channel_id: string | null;
    input: Record<string, unknown>;
    upstream_task_id: string | null;
    result: Record<string, unknown> | null;
    result_patch: CanvasJobResultPatch | null;
    error: Record<string, unknown> | null;
    attempt: number;
    max_attempts: number;
    lease_owner: string | null;
    lease_expires_at: string | null;
    heartbeat_at: string | null;
    queued_at: string;
    started_at: string | null;
    finished_at: string | null;
    created_at: string;
    updated_at: string;
};

export type CanvasJobCreateInput = Pick<CanvasJob, "canvas_id" | "target_node_id" | "generation_revision" | "client_request_id" | "kind" | "model_id" | "channel_id" | "input"> & {
    parent_job_id?: string | null;
    batch_id?: string | null;
    candidate_index?: number | null;
    max_attempts?: number;
};

export type PublicCanvasJob = {
    id: string;
    canvasId: string;
    parentJobId: string | null;
    batchId?: string | null;
    candidateIndex?: number | null;
    targetNodeId: string;
    generationRevision: number;
    clientRequestId: string;
    kind: CanvasJobKind;
    status: CanvasJobStatus;
    modelId: string | null;
    result: Record<string, unknown> | null;
    resultPatch: CanvasJobResultPatch | null;
    error: Record<string, unknown> | null;
    attempt: number;
    queuedAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    createdAt: string;
    updatedAt: string;
};

export type CanvasJobRepository = {
    create(userId: string, input: CanvasJobCreateInput): Promise<CanvasJob>;
    get(userId: string, jobId: string): Promise<CanvasJob | null>;
    list(userId: string, filters?: { canvasId?: string; status?: CanvasJobStatus; batchId?: string }): Promise<CanvasJob[]>;
    update(jobId: string, patch: Partial<CanvasJob>): Promise<CanvasJob | null>;
    claim(workerId: string, limit: number, leaseSeconds: number): Promise<CanvasJob[]>;
};

export type ViralBatchStatus = "queued" | "running" | "paused" | "completed" | "failed" | "cancelled";

export type ViralBatch = {
    id: string;
    user_id: string;
    canvas_id: string;
    target_node_id: string;
    generation_revision: number;
    client_request_id: string;
    template_id: string;
    candidate_count: number;
    model_id: string | null;
    channel_id: string | null;
    status: ViralBatchStatus;
    input: Record<string, unknown>;
    max_in_flight: number;
    next_candidate_index: number;
    queued_count: number;
    running_count: number;
    succeeded_count: number;
    failed_count: number;
    cancelled_count: number;
    created_at: string;
    updated_at: string;
    finished_at: string | null;
};

export type ViralBatchCreateInput = Pick<ViralBatch, "canvas_id" | "target_node_id" | "generation_revision" | "client_request_id" | "template_id" | "candidate_count" | "model_id" | "channel_id" | "input" | "max_in_flight">;

export type ViralBatchRepository = {
    create(userId: string, input: ViralBatchCreateInput): Promise<ViralBatch>;
    get(userId: string, batchId: string): Promise<ViralBatch | null>;
    getInternal(batchId: string): Promise<ViralBatch | null>;
    list(userId: string, canvasId?: string): Promise<ViralBatch[]>;
    listActive(): Promise<ViralBatch[]>;
    update(batchId: string, patch: Partial<ViralBatch>): Promise<ViralBatch | null>;
};

export type PublicViralBatch = {
    id: string;
    canvasId: string;
    targetNodeId: string;
    generationRevision: number;
    clientRequestId: string;
    templateId: string;
    candidateCount: number;
    modelId: string | null;
    status: ViralBatchStatus;
    maxInFlight: number;
    nextCandidateIndex: number;
    queuedCount: number;
    runningCount: number;
    succeededCount: number;
    failedCount: number;
    cancelledCount: number;
    createdAt: string;
    updatedAt: string;
    finishedAt: string | null;
};
