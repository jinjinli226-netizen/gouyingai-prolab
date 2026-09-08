import { gatewayEnvelopeRequest, gatewayRequest, getCanvasJob } from "./canvas-jobs";
import type { CanvasJob, CanvasJobStatus } from "@/types/canvas-job";

export type ViralBatchStatus = "queued" | "running" | "paused" | "completed" | "failed" | "cancelled";
export type ViralBatch = {
    id: string; canvasId: string; targetNodeId: string; generationRevision: number; clientRequestId: string; templateId: string;
    candidateCount: number; modelId: string | null; status: ViralBatchStatus; maxInFlight: number; nextCandidateIndex: number;
    queuedCount: number; runningCount: number; succeededCount: number; failedCount: number; cancelledCount: number;
    createdAt: string; updatedAt: string; finishedAt: string | null;
};

export type CreateViralBatchInput = {
    canvasId: string; targetNodeId: string; generationRevision: number; clientRequestId: string; templateId: string;
    candidateCount: number; modelId: string | null; channelId: string | null; maxInFlight: number; input: Record<string, unknown>;
    costEstimateCents?: number; authorizedCostCents?: number;
};

export type ViralBatchCandidatePage = { data: CanvasJob[]; meta: { offset: number; limit: number; total: number } };

export const createViralBatch = (input: CreateViralBatchInput) => gatewayRequest<ViralBatch>("/v1/viral-batches", { method: "POST", body: JSON.stringify(input) });
export const listViralBatches = (canvasId?: string) => gatewayRequest<ViralBatch[]>(`/v1/viral-batches${canvasId ? `?canvasId=${encodeURIComponent(canvasId)}` : ""}`);
export const getViralBatch = (batchId: string) => gatewayRequest<ViralBatch>(`/v1/viral-batches/${encodeURIComponent(batchId)}`);
export const listViralBatchCandidates = async (batchId: string, options: { offset?: number; limit?: number; status?: CanvasJobStatus } = {}) => {
    const query = new URLSearchParams({ offset: String(options.offset || 0), limit: String(options.limit || 20) });
    if (options.status) query.set("status", options.status);
    const response = await gatewayEnvelopeRequest<CanvasJob[], ViralBatchCandidatePage["meta"]>(`/v1/viral-batches/${encodeURIComponent(batchId)}/candidates?${query}`);
    const candidates = response.data || [];
    const data = await Promise.all(candidates.map(async (candidate) => {
        if (candidate.status !== "succeeded") return candidate;
        return getCanvasJob(candidate.id).catch(() => candidate);
    }));
    return { data, meta: response.meta || { offset: options.offset || 0, limit: options.limit || 20, total: 0 } };
};
export const pauseViralBatch = (batchId: string) => batchAction(batchId, "pause");
export const resumeViralBatch = (batchId: string) => batchAction(batchId, "resume");
export const cancelViralBatch = (batchId: string) => batchAction(batchId, "cancel");
export const retryFailedViralBatch = (batchId: string) => batchAction(batchId, "retry-failed");
const batchAction = (batchId: string, action: string) => gatewayRequest<ViralBatch>(`/v1/viral-batches/${encodeURIComponent(batchId)}/${action}`, { method: "POST" });
