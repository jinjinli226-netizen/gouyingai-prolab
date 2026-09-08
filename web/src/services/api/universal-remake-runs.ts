import { gatewayRequest } from "./canvas-jobs";

export type UniversalRemakeRunStatus = "queued" | "running" | "paused" | "completed" | "failed" | "cancelled";
export type UniversalRemakeFidelityStatus = "not-evaluated" | "pending" | "passed" | "failed";
export type UniversalRemakeRun = {
    id: string;
    canvas_id: string;
    status: UniversalRemakeRunStatus;
    succeeded_count: number;
    failed_count: number;
    cancelled_count: number;
    candidates: Array<{
        index: number;
        status: string;
        output_artifact_uri: string | null;
        error: string | null;
        failure_stage: string | null;
        fidelity_status?: UniversalRemakeFidelityStatus;
        fidelity_issues?: string[];
        fidelity_matched_fact_ids?: string[];
        fidelity_missing_fact_ids?: string[];
        corrected_retry_prompt?: string | null;
    }>;
    updated_at: string;
};

export type CreateUniversalRemakeRunInput = {
    canvasId: string;
    targetNodeId: string;
    generationRevision: number;
    clientRequestId: string;
    templateId: string;
    modelId: string | null;
    channelId: string | null;
    maxInFlight: number;
    candidates: unknown[];
};

export const createUniversalRemakeRun = (input: CreateUniversalRemakeRunInput) => gatewayRequest<UniversalRemakeRun>("/v1/universal-remake-runs", { method: "POST", body: JSON.stringify(input) });
export const listUniversalRemakeRuns = (canvasId?: string) => gatewayRequest<UniversalRemakeRun[]>(`/v1/universal-remake-runs${canvasId ? `?canvasId=${encodeURIComponent(canvasId)}` : ""}`);
export const getUniversalRemakeRun = (id: string) => gatewayRequest<UniversalRemakeRun>(`/v1/universal-remake-runs/${encodeURIComponent(id)}`);
export const pauseUniversalRemakeRun = (id: string) => action(id, "pause");
export const resumeUniversalRemakeRun = (id: string) => action(id, "resume");
export const cancelUniversalRemakeRun = (id: string) => action(id, "cancel");
export const retryUniversalRemakeComposition = (id: string, candidateIndex: number) => gatewayRequest<UniversalRemakeRun>(`/v1/universal-remake-runs/${encodeURIComponent(id)}/candidates/${candidateIndex}/retry-composition`, { method: "POST" });
const action = (id: string, name: string) => gatewayRequest<UniversalRemakeRun>(`/v1/universal-remake-runs/${encodeURIComponent(id)}/${name}`, { method: "POST" });
