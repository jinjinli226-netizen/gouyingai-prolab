import type { CanvasJob, CanvasJobResultPatch, CanvasJobStatus, PublicCanvasJob } from "./types.js";

const transitions: Record<CanvasJobStatus, ReadonlySet<CanvasJobStatus>> = {
    queued: new Set(["leased", "cancelled"]),
    leased: new Set(["queued", "submitting", "running", "failed", "cancel_requested", "cancelled"]),
    submitting: new Set(["running", "succeeded", "failed", "cancel_requested"]),
    running: new Set(["succeeded", "failed", "cancel_requested"]),
    cancel_requested: new Set(["cancelled", "succeeded", "failed"]),
    succeeded: new Set(),
    failed: new Set(),
    cancelled: new Set(),
};

export function canTransitionCanvasJob(from: CanvasJobStatus, to: CanvasJobStatus) {
    return transitions[from]?.has(to) || false;
}

export function matchesCanvasJobResultPatch(job: CanvasJob, patch: CanvasJobResultPatch) {
    return patch.canvasId === job.canvas_id && patch.nodeId === job.target_node_id && patch.jobId === job.id && patch.generationRevision === job.generation_revision;
}

export function toPublicCanvasJob(job: CanvasJob): PublicCanvasJob {
    return {
        id: job.id,
        canvasId: job.canvas_id,
        parentJobId: job.parent_job_id,
        ...(Object.prototype.hasOwnProperty.call(job, "batch_id") ? { batchId: job.batch_id } : {}),
        ...(Object.prototype.hasOwnProperty.call(job, "candidate_index") ? { candidateIndex: job.candidate_index } : {}),
        targetNodeId: job.target_node_id,
        generationRevision: job.generation_revision,
        clientRequestId: job.client_request_id,
        kind: job.kind,
        status: job.status,
        modelId: job.model_id,
        result: job.result,
        resultPatch: job.result_patch,
        error: job.error,
        attempt: job.attempt,
        queuedAt: job.queued_at,
        startedAt: job.started_at,
        finishedAt: job.finished_at,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
    };
}
