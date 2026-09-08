import express from "express";
import { canTransitionCanvasJob, toPublicCanvasJob } from "./canvas-jobs.js";
const kinds = new Set(["text", "image", "video", "audio", "viral-analysis", "viral-plan", "viral-video", "viral-quality"]);
const statuses = new Set(["queued", "leased", "submitting", "running", "succeeded", "failed", "cancel_requested", "cancelled"]);
export function createCanvasJobRouter(repository, getUserId) {
    const router = express.Router();
    router.post("/", async (req, res) => {
        try {
            const input = parseCreateInput(req.body);
            const job = await repository.create(getUserId(res), input);
            res.status(201).json({ data: toPublicCanvasJob(job) });
        }
        catch (error) {
            sendError(res, error);
        }
    });
    router.get("/", async (req, res) => {
        try {
            const status = req.query.status ? String(req.query.status) : undefined;
            if (status && !statuses.has(status))
                throw new RequestError("无效的任务状态");
            const jobs = await repository.list(getUserId(res), {
                canvasId: req.query.canvasId ? String(req.query.canvasId) : undefined,
                status,
            });
            res.json({ data: jobs.map(toPublicCanvasJob) });
        }
        catch (error) {
            sendError(res, error);
        }
    });
    router.get("/:id", async (req, res) => {
        try {
            const job = await repository.get(getUserId(res), pathParameter(req.params.id));
            if (!job)
                return void res.status(404).json({ error: "画布任务不存在" });
            res.json({ data: toPublicCanvasJob(job) });
        }
        catch (error) {
            sendError(res, error);
        }
    });
    router.post("/:id/cancel", async (req, res) => {
        try {
            const job = await repository.get(getUserId(res), pathParameter(req.params.id));
            if (!job)
                return void res.status(404).json({ error: "画布任务不存在" });
            if (["succeeded", "failed", "cancelled"].includes(job.status))
                return void res.json({ data: toPublicCanvasJob(job) });
            const nextStatus = job.status === "queued" ? "cancelled" : "cancel_requested";
            if (!canTransitionCanvasJob(job.status, nextStatus))
                return void res.status(409).json({ error: "当前任务状态不可取消" });
            const updated = await repository.update(job.id, {
                status: nextStatus,
                ...(nextStatus === "cancelled" ? { finished_at: new Date().toISOString() } : {}),
            });
            res.json({ data: toPublicCanvasJob(updated || job) });
        }
        catch (error) {
            sendError(res, error);
        }
    });
    router.post("/:id/retry", async (req, res) => {
        try {
            const original = await repository.get(getUserId(res), pathParameter(req.params.id));
            if (!original)
                return void res.status(404).json({ error: "画布任务不存在" });
            const clientRequestId = requiredString(req.body?.clientRequestId, "clientRequestId");
            const generationRevision = positiveInteger(req.body?.generationRevision, "generationRevision");
            const job = await repository.create(getUserId(res), {
                canvas_id: original.canvas_id,
                parent_job_id: original.id,
                target_node_id: original.target_node_id,
                generation_revision: generationRevision,
                client_request_id: clientRequestId,
                kind: original.kind,
                model_id: original.model_id,
                channel_id: original.channel_id,
                input: original.input,
                max_attempts: original.max_attempts,
            });
            res.status(201).json({ data: toPublicCanvasJob(job) });
        }
        catch (error) {
            sendError(res, error);
        }
    });
    return router;
}
function parseCreateInput(body) {
    const kind = requiredString(body?.kind, "kind");
    if (!kinds.has(kind))
        throw new RequestError("无效的任务类型");
    const input = body?.input;
    if (!input || typeof input !== "object" || Array.isArray(input))
        throw new RequestError("input 必须是对象");
    return {
        canvas_id: requiredString(body?.canvasId, "canvasId"),
        parent_job_id: optionalString(body?.parentJobId),
        batch_id: optionalString(body?.batchId),
        candidate_index: optionalNonNegativeInteger(body?.candidateIndex, "candidateIndex"),
        target_node_id: requiredString(body?.targetNodeId, "targetNodeId"),
        generation_revision: positiveInteger(body?.generationRevision, "generationRevision"),
        client_request_id: requiredString(body?.clientRequestId, "clientRequestId"),
        kind,
        model_id: optionalString(body?.modelId),
        channel_id: optionalString(body?.channelId),
        input: input,
        max_attempts: body?.maxAttempts === undefined ? undefined : positiveInteger(body.maxAttempts, "maxAttempts"),
    };
}
function requiredString(value, field) {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (!normalized)
        throw new RequestError(`${field} 必填`);
    return normalized;
}
function optionalString(value) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}
function pathParameter(value) {
    return Array.isArray(value) ? value[0] : value;
}
function positiveInteger(value, field) {
    const normalized = Number(value);
    if (!Number.isInteger(normalized) || normalized <= 0)
        throw new RequestError(`${field} 必须是正整数`);
    return normalized;
}
function optionalNonNegativeInteger(value, field) {
    if (value === undefined || value === null)
        return null;
    const normalized = Number(value);
    if (!Number.isInteger(normalized) || normalized < 0)
        throw new RequestError(`${field} 必须是非负整数`);
    return normalized;
}
class RequestError extends Error {
}
function sendError(res, error) {
    const status = error instanceof RequestError ? 400 : 500;
    res.status(status).json({ error: error instanceof Error ? error.message : "画布任务请求失败" });
}
//# sourceMappingURL=canvas-job-routes.js.map