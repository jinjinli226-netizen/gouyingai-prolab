import { fetchGatewayCatalog, gatewayBaseUrl } from "@/services/gateway-admin";
import { resolveCanvasArtifactUrl } from "@/services/api/canvas-artifacts";
import { shouldRefreshCanvasArtifactUrl } from "@/lib/canvas/canvas-image-hydration";
import { supabase } from "@/services/supabase-client";
import type { CanvasJob, CanvasJobKind, CanvasJobStatus, CreateCanvasJobInput } from "@/types/canvas-job";

export async function resolveCanvasJobModelBinding(modelName: string, capability: "text" | "image" | "video" | "audio") {
    const requestedModelName = modelName.normalize("NFKC").trim();
    const models = await fetchGatewayCatalog(capability);
    const model = models.find((item) => item.modelName.normalize("NFKC").trim() === requestedModelName && item.capability === capability);
    if (!model?.bindingId || !model.channelId) throw new Error(`Gateway 中找不到 ${requestedModelName || modelName} 的固定路由`);
    return { bindingId: model.bindingId, channelId: model.channelId };
}

export async function createCanvasJob(input: CreateCanvasJobInput) {
    return gatewayRequest<CanvasJob>("/v1/canvas-jobs", { method: "POST", body: JSON.stringify(input) });
}

export async function listCanvasJobs(filters: { canvasId?: string; status?: CanvasJobStatus } = {}) {
    const query = new URLSearchParams();
    if (filters.canvasId) query.set("canvasId", filters.canvasId);
    if (filters.status) query.set("status", filters.status);
    const jobs = await gatewayRequest<CanvasJob[]>(`/v1/canvas-jobs${query.size ? `?${query}` : ""}`);
    return filters.canvasId ? Promise.all(jobs.map(refreshExpiredCanvasArtifact)) : jobs;
}

export async function getCanvasJob(jobId: string) {
    return refreshExpiredCanvasArtifact(await gatewayRequest<CanvasJob>(`/v1/canvas-jobs/${encodeURIComponent(jobId)}`));
}

export async function cancelCanvasJob(jobId: string) {
    return gatewayRequest<CanvasJob>(`/v1/canvas-jobs/${encodeURIComponent(jobId)}/cancel`, { method: "POST" });
}

export async function retryCanvasJob(jobId: string, input: { clientRequestId: string; generationRevision: number }) {
    return gatewayRequest<CanvasJob>(`/v1/canvas-jobs/${encodeURIComponent(jobId)}/retry`, { method: "POST", body: JSON.stringify(input) });
}

export function canvasJobReference(job: CanvasJob) {
    return {
        generationJobId: job.id,
        generationRevision: job.generationRevision,
        generationStatus: job.status,
    };
}

export function isCanvasJobKind(value: string): value is CanvasJobKind {
    return ["text", "image", "video", "audio", "viral-analysis", "viral-plan", "viral-video", "viral-quality"].includes(value);
}

export async function gatewayRequest<T>(path: string, init: RequestInit = {}) {
    const body = await gatewayEnvelopeRequest<T>(path, init);
    return body.data as T;
}

export async function gatewayEnvelopeRequest<T, TMeta = unknown>(path: string, init: RequestInit = {}) {
    if (!gatewayBaseUrl) throw new Error("尚未配置 Gateway，不能创建后台画布任务");
    let token = "";
    if (supabase) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token || "";
    }
    const response = await fetch(`${gatewayBaseUrl}${path}`, {
        ...init,
        headers: {
            "content-type": "application/json",
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            ...(init.headers || {}),
        },
    });
    const body = (await response.json().catch(() => ({}))) as { data?: T; meta?: TMeta; error?: string };
    if (!response.ok) throw new Error(body.error || `画布任务请求失败（${response.status}）`);
    return body;
}

const refreshedArtifactUrls = new Map<string, { url: string; expiresAt: number }>();

async function refreshExpiredCanvasArtifact(job: CanvasJob) {
    if (job.status !== "succeeded" || !job.resultPatch) return job;
    const nodePatch = job.resultPatch.nodePatch;
    const metadata = nodePatch.metadata && typeof nodePatch.metadata === "object" && !Array.isArray(nodePatch.metadata) ? nodePatch.metadata as Record<string, unknown> : null;
    const storageKey = typeof metadata?.storageKey === "string" ? metadata.storageKey : "";
    const content = typeof metadata?.content === "string" ? metadata.content : "";
    if (!shouldRefreshCanvasArtifactUrl(storageKey, content)) return job;
    const cached = refreshedArtifactUrls.get(storageKey);
    const url = cached && cached.expiresAt > Date.now() ? cached.url : await resolveCanvasArtifactUrl(job.canvasId, storageKey);
    if (!cached || cached.url !== url) refreshedArtifactUrls.set(storageKey, { url, expiresAt: Date.now() + 50 * 60 * 1000 });
    return {
        ...job,
        result: job.result ? { ...job.result, url } : job.result,
        resultPatch: { ...job.resultPatch, nodePatch: { ...nodePatch, metadata: { ...metadata, content: url } } },
    };
}
