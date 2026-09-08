import express, { type Request, type Response } from "express";

import { toPublicCanvasJob } from "./canvas-jobs.js";
import type { CanvasJobRepository, PublicViralBatch, ViralBatchCreateInput, ViralBatchRepository } from "./types.js";

export function createViralBatchRouter(batches: ViralBatchRepository, jobs: CanvasJobRepository, getUserId: (res: Response) => string) {
    const router = express.Router();
    router.post("/", async (req, res) => {
        try {
            const batch = await batches.create(getUserId(res), parseCreateInput(req.body));
            res.status(201).json({ data: toPublicViralBatch(batch) });
        } catch (error) { sendError(res, error); }
    });
    router.get("/", async (req, res) => {
        try { res.json({ data: (await batches.list(getUserId(res), optionalString(req.query.canvasId) || undefined)).map(toPublicViralBatch) }); }
        catch (error) { sendError(res, error); }
    });
    router.get("/:id/candidates", async (req, res) => {
        try {
            const batch = await batches.get(getUserId(res), pathParameter(req.params.id));
            if (!batch) return void res.status(404).json({ error: "爆款复刻批次不存在" });
            const offset = integer(req.query.offset ?? 0, "offset", 0);
            const limit = integer(req.query.limit ?? 20, "limit", 1, 100);
            const status = optionalString(req.query.status);
            const all = (await jobs.list(batch.user_id, { batchId: batch.id }))
                .filter((job) => job.kind === "viral-video")
                .filter((job) => !status || job.status === status)
                .sort((left, right) => (left.candidate_index ?? 0) - (right.candidate_index ?? 0));
            res.json({ data: all.slice(offset, offset + limit).map(toPublicCanvasJob), meta: { offset, limit, total: all.length } });
        } catch (error) { sendError(res, error); }
    });
    router.get("/:id", async (req, res) => {
        try {
            const batch = await batches.get(getUserId(res), pathParameter(req.params.id));
            if (!batch) return void res.status(404).json({ error: "爆款复刻批次不存在" });
            res.json({ data: toPublicViralBatch(batch) });
        } catch (error) { sendError(res, error); }
    });
    router.post("/:id/pause", action(async (batch) => [batch.status === "cancelled" || batch.status === "completed" ? batch.status : "paused", null]));
    router.post("/:id/resume", action(async (batch) => [batch.status === "cancelled" || batch.status === "completed" ? batch.status : "running", null]));
    router.post("/:id/cancel", action(async (batch) => {
        const children = await jobs.list(batch.user_id, { batchId: batch.id });
        await Promise.all(children.map((job) => jobs.update(job.id, job.status === "queued" ? { status: "cancelled", finished_at: new Date().toISOString() } : ["leased", "submitting", "running"].includes(job.status) ? { status: "cancel_requested" } : {})));
        return ["cancelled", new Date().toISOString()];
    }));
    router.post("/:id/retry-failed", action(async (batch) => {
        const failed = (await jobs.list(batch.user_id, { batchId: batch.id })).filter((job) => job.kind === "viral-video" && job.status === "failed");
        await Promise.all(failed.map((job) => jobs.create(batch.user_id, {
            canvas_id: job.canvas_id, batch_id: batch.id, candidate_index: job.candidate_index, parent_job_id: job.id,
            target_node_id: job.target_node_id, generation_revision: job.generation_revision + 1,
            client_request_id: `${batch.client_request_id}:retry:${job.candidate_index}:${job.id}`,
            kind: job.kind, model_id: job.model_id, channel_id: job.channel_id, input: job.input, max_attempts: job.max_attempts,
        })));
        return ["running", null];
    }));

    function action(run: (batch: NonNullable<Awaited<ReturnType<ViralBatchRepository["get"]>>>) => Promise<[NonNullable<Awaited<ReturnType<ViralBatchRepository["get"]>>>["status"], string | null]>) {
        return async (req: Request, res: Response) => {
            try {
                const batch = await batches.get(getUserId(res), pathParameter(req.params.id));
                if (!batch) return void res.status(404).json({ error: "爆款复刻批次不存在" });
                const [status, finished_at] = await run(batch);
                const updated = await batches.update(batch.id, { status, finished_at });
                res.json({ data: toPublicViralBatch(updated || batch) });
            } catch (error) { sendError(res, error); }
        };
    }
    return router;
}

export function toPublicViralBatch(batch: NonNullable<Awaited<ReturnType<ViralBatchRepository["get"]>>>): PublicViralBatch {
    return {
        id: batch.id, canvasId: batch.canvas_id, targetNodeId: batch.target_node_id, generationRevision: batch.generation_revision,
        clientRequestId: batch.client_request_id, templateId: batch.template_id, candidateCount: batch.candidate_count,
        modelId: batch.model_id, status: batch.status, maxInFlight: batch.max_in_flight, nextCandidateIndex: batch.next_candidate_index,
        queuedCount: batch.queued_count, runningCount: batch.running_count, succeededCount: batch.succeeded_count,
        failedCount: batch.failed_count, cancelledCount: batch.cancelled_count, createdAt: batch.created_at, updatedAt: batch.updated_at, finishedAt: batch.finished_at,
    };
}

function parseCreateInput(body: Record<string, unknown> | undefined): ViralBatchCreateInput {
    const candidateCount = integer(body?.candidateCount, "candidateCount", 1, 1000);
    const input = body?.input;
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new RequestError("input 必须是对象");
    const manifests = (input as Record<string, unknown>).manifests;
    if (!Array.isArray(manifests) || manifests.length < candidateCount) throw new RequestError("input.manifests 必须覆盖全部候选");
    const costEstimateCents = optionalNonNegativeNumber(body?.costEstimateCents, "costEstimateCents");
    const authorizedCostCents = optionalNonNegativeNumber(body?.authorizedCostCents, "authorizedCostCents");
    if (costEstimateCents !== null && costEstimateCents > 1000 && (authorizedCostCents === null || authorizedCostCents < costEstimateCents)) {
        throw new RequestError(`预计费用 ${costEstimateCents} 分超过免确认额度，需明确授权完整金额`);
    }
    return {
        canvas_id: requiredString(body?.canvasId, "canvasId"), target_node_id: requiredString(body?.targetNodeId, "targetNodeId"),
        generation_revision: integer(body?.generationRevision, "generationRevision", 1), client_request_id: requiredString(body?.clientRequestId, "clientRequestId"),
        template_id: requiredString(body?.templateId, "templateId"), candidate_count: candidateCount,
        model_id: optionalString(body?.modelId), channel_id: optionalString(body?.channelId), input: {
            ...(input as Record<string, unknown>),
            costPreflight: costEstimateCents === null ? undefined : { estimateCents: costEstimateCents, authorizedCents: authorizedCostCents },
        },
        max_in_flight: integer(body?.maxInFlight ?? 2, "maxInFlight", 1, 20),
    };
}

function requiredString(value: unknown, field: string) { const text = typeof value === "string" ? value.trim() : ""; if (!text) throw new RequestError(`${field} 必填`); return text; }
function optionalString(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function pathParameter(value: string | string[]) { return Array.isArray(value) ? value[0] : value; }
function integer(value: unknown, field: string, min: number, max = Number.MAX_SAFE_INTEGER) { const number = Number(value); if (!Number.isInteger(number) || number < min || number > max) throw new RequestError(`${field} 必须在 ${min}-${max} 之间`); return number; }
function optionalNonNegativeNumber(value: unknown, field: string) { if (value === undefined || value === null || value === "") return null; const number = Number(value); if (!Number.isFinite(number) || number < 0) throw new RequestError(`${field} 必须是非负数`); return number; }
class RequestError extends Error {}
function sendError(res: Response, error: unknown) { res.status(error instanceof RequestError ? 400 : 500).json({ error: error instanceof Error ? error.message : "爆款复刻批次请求失败" }); }
