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

export type CanvasJobReference = {
    generationJobId: string;
    generationRevision: number;
    generationStatus: CanvasJobStatus;
};

export type CreateCanvasJobInput = {
    canvasId: string;
    targetNodeId: string;
    generationRevision: number;
    clientRequestId: string;
    kind: CanvasJobKind;
    modelId: string | null;
    channelId: string | null;
    input: Record<string, unknown>;
    parentJobId?: string | null;
    batchId?: string | null;
    candidateIndex?: number | null;
    maxAttempts?: number;
};
