import express, { type Response } from "express";

import type { UniversalRemakeCoordinator } from "./coordinator.js";
import type { UniversalRemakeRunCreateInput, UniversalRemakeRunRepository, UniversalRunCandidateManifest } from "./types.js";

export function createUniversalRemakeRouter(
    runs: UniversalRemakeRunRepository,
    coordinator: UniversalRemakeCoordinator,
    getUserId: (res: Response) => string,
) {
    const router = express.Router();
    router.post("/", async (req, res) => {
        try {
            const run = await runs.create(getUserId(res), parseCreateInput(req.body));
            await coordinator.reconcile(run.id);
            res.status(201).json({ data: await runs.get(getUserId(res), run.id) });
        } catch (error) { sendError(res, error); }
    });
    router.get("/", async (req, res) => {
        try { res.json({ data: await runs.list(getUserId(res), optionalString(req.query.canvasId) || undefined) }); }
        catch (error) { sendError(res, error); }
    });
    router.get("/:id", async (req, res) => {
        try {
            const run = await runs.get(getUserId(res), pathParameter(req.params.id));
            if (!run) return void res.status(404).json({ error: "通用复刻运行不存在" });
            res.json({ data: run });
        } catch (error) { sendError(res, error); }
    });
    router.post("/:id/pause", action(async (id) => coordinator.pause(id)));
    router.post("/:id/resume", action(async (id) => { const result = await coordinator.resume(id); await coordinator.reconcile(id); return result; }));
    router.post("/:id/cancel", action(async (id) => coordinator.cancel(id)));
    router.post("/:id/candidates/:index/retry-composition", action(async (id, req) => {
        await coordinator.retryComposition(id, integer(req.params.index, "index", 0, 999));
        await coordinator.reconcile(id);
        return runs.getInternal(id);
    }));

    function action(run: (id: string, req: express.Request) => Promise<unknown>) {
        return async (req: express.Request, res: express.Response) => {
            try {
                const id = pathParameter(req.params.id);
                if (!await runs.get(getUserId(res), id)) return void res.status(404).json({ error: "通用复刻运行不存在" });
                res.json({ data: await run(id, req) });
            } catch (error) { sendError(res, error); }
        };
    }
    return router;
}

function parseCreateInput(body: Record<string, unknown> | undefined): UniversalRemakeRunCreateInput {
    const candidates = body?.candidates;
    if (!Array.isArray(candidates) || !candidates.length || candidates.length > 1000) throw new RequestError("candidates 必须包含 1-1000 个完整候选计划");
    candidates.forEach((candidate, index) => validateCandidate(candidate, index));
    return {
        canvas_id: requiredString(body?.canvasId, "canvasId"), target_node_id: requiredString(body?.targetNodeId, "targetNodeId"),
        generation_revision: integer(body?.generationRevision, "generationRevision", 1), client_request_id: requiredString(body?.clientRequestId, "clientRequestId"),
        template_id: requiredString(body?.templateId, "templateId"), model_id: optionalString(body?.modelId), channel_id: optionalString(body?.channelId),
        max_in_flight: integer(body?.maxInFlight ?? 2, "maxInFlight", 1, 20), candidates: candidates as UniversalRunCandidateManifest[],
    };
}

function validateCandidate(value: unknown, index: number) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new RequestError(`候选 ${index + 1} 无效`);
    const candidate = value as Record<string, unknown>;
    if (!requiredString(candidate.id, `候选 ${index + 1}.id`) || !Array.isArray(candidate.segments) || !candidate.segments.length) throw new RequestError(`候选 ${index + 1} 缺少分段`);
    if (!candidate.output || typeof candidate.output !== "object" || !["direct-video", "composed-video"].includes(String((candidate.output as Record<string, unknown>).kind))) throw new RequestError(`候选 ${index + 1} 输出计划无效`);
}

function requiredString(value: unknown, field: string) { const text = typeof value === "string" ? value.trim() : ""; if (!text) throw new RequestError(`${field} 必填`); return text; }
function optionalString(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function pathParameter(value: string | string[]) { return Array.isArray(value) ? value[0] : value; }
function integer(value: unknown, field: string, min: number, max = Number.MAX_SAFE_INTEGER) { const number = Number(value); if (!Number.isInteger(number) || number < min || number > max) throw new RequestError(`${field} 必须在 ${min}-${max} 之间`); return number; }
class RequestError extends Error {}
function sendError(res: Response, error: unknown) { res.status(error instanceof RequestError ? 400 : 500).json({ error: error instanceof Error ? error.message : "通用复刻请求失败" }); }
