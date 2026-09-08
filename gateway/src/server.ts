import cors from "cors";
import express, { type Request, type Response, type Router } from "express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { registerAdminRoutes } from "./admin.js";
import { buildAutoDlWorkflowRequest, parseUnifiedVideoInput, queryAutoDlWorkflow, submitAutoDlWorkflow } from "./autodl-comfyui.js";
import { createSupabaseCanvasArtifactRouter } from "./canvas-artifact-routes.js";
import { createSupabaseCanvasJobRepository } from "./canvas-job-repository.js";
import { createCanvasJobRouter } from "./canvas-job-routes.js";
import { createSupabaseViralBatchRepository } from "./viral-batch-repository.js";
import { createViralBatchRouter } from "./viral-batch-routes.js";
import { createSupabaseUniversalCompositionPort, createSupabaseUniversalRemakeRepository, createUniversalRemakeRouter, UniversalRemakeCoordinator } from "./universal-viral-remake/index.js";
import { gatewayCorsErrorHandler, gatewayCorsOptions } from "./cors.js";
import { createRequireAdmin, createRequireAuth } from "./auth.js";
import { buildUpstreamUrl, extractModelNameFromJson, extractModelNameFromMultipart, MODEL_CAPABILITY_HEADER, parseModelCapability, pickChannelById, pickModelByName, toPublicModel, unambiguousPublishedModels } from "./catalog.js";
import { decryptSecret } from "./encryption.js";
import { forwardGeminiChatCompletion } from "./gemini-chat-adapter.js";
import type { Channel, GatewayTask, Model } from "./types.js";

export type GatewayContext = {
    auth: SupabaseClient;
    admin: SupabaseClient;
    memoryTasks: Map<string, GatewayTask>;
};

export function createGatewayApp(context: GatewayContext) {
    const { auth, admin, memoryTasks } = context;
    const app = express();
    app.disable("x-powered-by");
    app.use(cors(gatewayCorsOptions()));
    app.use(express.json({ limit: "30mb" }));

    const requireAuth = createRequireAuth(auth);
    const requireAdmin = createRequireAdmin(admin);

    app.get("/health", (_req, res) => res.json({ ok: true }));

    app.get("/v1/models", requireAuth, async (req: Request, res: Response) => {
        res.set("Cache-Control", "no-store");
        const { data: models, error } = await admin.from("gouyingai_models").select("*").eq("published", true).order("sort_order");
        if (error) return void res.status(500).json({ error: error.message });
        const { data: channels } = await admin.from("gouyingai_channels").select("*").eq("enabled", true);
        const capability = String(req.query.capability || "");
        const enabledChannelIds = new Set((channels || []).map((channel) => channel.id));
        const published = unambiguousPublishedModels(((models || []) as Model[]).filter((model) => enabledChannelIds.has(model.channel_id)));
        const filtered = capability ? published.filter((model) => model.capability === capability) : published;
        res.json({ data: (filtered as Model[]).map((model) => toPublicModel(model, (channels || []).find((channel) => channel.id === model.channel_id))) });
    });

    app.use("/v1/canvas-artifacts", requireAuth, createSupabaseCanvasArtifactRouter(admin, (res) => res.locals.user.id));
    const canvasJobs = createSupabaseCanvasJobRepository(admin);
    app.use("/v1/canvas-jobs", requireAuth, createCanvasJobRouter(canvasJobs, (res) => res.locals.user.id));
    app.use("/v1/viral-batches", requireAuth, createViralBatchRouter(createSupabaseViralBatchRepository(admin), canvasJobs, (res) => res.locals.user.id));
    const universalRemakeRuns = createSupabaseUniversalRemakeRepository(admin);
    const universalRemakeCoordinator = new UniversalRemakeCoordinator(universalRemakeRuns, canvasJobs, createSupabaseUniversalCompositionPort(admin));
    universalRemakeCoordinator.start();
    app.use("/v1/universal-remake-runs", requireAuth, createUniversalRemakeRouter(universalRemakeRuns, universalRemakeCoordinator, (res) => res.locals.user.id));

    app.all("/v1/*splat", requireAuth, express.raw({ type: () => true, limit: "100mb" }), async (req: Request, res: Response) => {
        const videoTaskMatch = req.path.match(/^\/v1\/videos\/([^/]+)(?:\/content)?$/);
        if (req.method === "GET" && videoTaskMatch) {
            const videoTaskId = videoTaskMatch[1];
            const task = memoryTasks.get(videoTaskId) || ((await admin.from("gouyingai_gateway_tasks").select("*").eq("task_id", videoTaskId).maybeSingle()).data as GatewayTask | null);
            if (task && task.user_id === res.locals.user.id && task.capability === "video") {
                const { data: channels } = await admin.from("gouyingai_channels").select("*");
                const taskChannel = (channels || []).find((item) => item.id === task.channel_id) as Channel | undefined;
                if (taskChannel) {
                    if (taskChannel.api_format === "autodl_comfyui") {
                        const { response: poll, task: state } = await queryAutoDlWorkflow(taskChannel.base_url, decryptSecret(taskChannel.key_ciphertext), task.upstream_task_id);
                        if (req.path.endsWith("/content")) {
                            if (state.status !== "completed" || !state.resultUrl) {
                                return void res.status(state.status === "failed" ? 502 : 409).json({ error: state.error || "AutoDL 视频尚未生成完成" });
                            }
                            const content = await fetch(state.resultUrl);
                            const contentBody = Buffer.from(await content.arrayBuffer());
                            res.status(content.status);
                            if (content.headers.get("content-type")) res.setHeader("content-type", content.headers.get("content-type") || "");
                            res.send(contentBody);
                            return;
                        }
                        res.status(poll.ok ? 200 : poll.status).json({
                            id: task.task_id,
                            status: state.status,
                            ...(state.error ? { error: { message: state.error } } : {}),
                        });
                        return;
                    }
                    const upstreamPath = req.path.endsWith("/content") ? `/videos/${task.upstream_task_id}/content` : `/videos/${task.upstream_task_id}`;
                    const pollUrl = buildUpstreamUrl(taskChannel.base_url, upstreamPath);
                    const poll = await fetch(pollUrl, { method: "GET", headers: { authorization: `Bearer ${decryptSecret(taskChannel.key_ciphertext)}` } });
                    const pollBody = Buffer.from(await poll.arrayBuffer());
                    res.status(poll.status);
                    if (poll.headers.get("content-type")) res.setHeader("content-type", poll.headers.get("content-type") || "");
                    res.send(pollBody);
                    return;
                }
            }
            return void res.status(404).json({ error: "视频任务不存在" });
        }

        const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
        const contentType = String(req.headers["content-type"] || "");
        const modelName = contentType.includes("multipart/form-data") ? extractModelNameFromMultipart(raw) : extractModelNameFromJson(raw.toString("utf8"));
        if (!modelName) return void res.status(400).json({ error: "请求体缺少 model 字段" });

        const [models, channels] = await Promise.all([
            admin.from("gouyingai_models").select("*"),
            admin.from("gouyingai_channels").select("*"),
        ]);
        const model = pickModelByName((models.data || []) as Model[], modelName);
        if (!model) return void res.status(404).json({ error: `模型 ${modelName} 未发布或不存在` });
        const requestedCapability = parseModelCapability(req.headers[MODEL_CAPABILITY_HEADER]);
        if (!requestedCapability) return void res.status(400).json({ error: "请求缺少有效的模型能力声明" });
        if (model.capability !== requestedCapability) return void res.status(409).json({ error: `模型 ${modelName} 不支持 ${requestedCapability} 请求` });
        const channel = pickChannelById((channels.data || []) as Channel[], model.channel_id);
        if (!channel) return void res.status(502).json({ error: "模型所在渠道不可用" });

        if (channel.api_format === "autodl_comfyui") {
            if (req.method !== "POST" || req.path !== "/v1/videos" || model.capability !== "video") {
                return void res.status(400).json({ error: "AutoDL ComfyUI 渠道当前只支持视频生成" });
            }
            let workflow: ReturnType<typeof buildAutoDlWorkflowRequest>;
            try {
                const input = await parseUnifiedVideoInput(raw, contentType);
                workflow = buildAutoDlWorkflowRequest(model.options, input);
            } catch (error) {
                return void res.status(400).json({ error: error instanceof Error ? error.message : "AutoDL 视频任务创建失败" });
            }
            let upstream: globalThis.Response;
            let normalized: Awaited<ReturnType<typeof submitAutoDlWorkflow>>["task"];
            try {
                ({ response: upstream, task: normalized } = await submitAutoDlWorkflow(channel.base_url, decryptSecret(channel.key_ciphertext), workflow));
            } catch (error) {
                return void res.status(502).json({ error: `AutoDL 上游请求失败：${error instanceof Error ? error.message : String(error)}` });
            }
            if (!upstream.ok || !normalized.upstreamTaskId || normalized.status === "failed") {
                return void res.status(upstream.ok ? 502 : upstream.status).json({ error: normalized.error || "AutoDL 视频接口没有返回任务 ID" });
            }
            const user = res.locals.user;
            const taskId = `gt-${crypto.randomUUID()}`;
            const task: GatewayTask = {
                task_id: taskId,
                user_id: user.id,
                channel_id: channel.id,
                model_id: model.id,
                upstream_task_id: normalized.upstreamTaskId,
                capability: model.capability,
            };
            memoryTasks.set(taskId, task);
            try {
                await admin.from("gouyingai_gateway_tasks").upsert(task);
            } catch {
                // in-memory fallback keeps polling working until restart
            }
            void recordUsage(admin, user.id, model.id, model.capability, upstream.status, 0);
            return void res.json({ id: taskId, status: normalized.status });
        }

        if (channel.api_format === "gemini" && req.method === "POST" && req.path === "/v1/chat/completions") {
            try {
                const result = await forwardGeminiChatCompletion(raw, channel, model.model_name, decryptSecret(channel.key_ciphertext));
                void recordUsage(admin, res.locals.user.id, model.id, model.capability, result.status, 0);
                return void res.status(result.status).json(result.payload);
            } catch (error) {
                return void res.status(502).json({ error: { message: `Gemini 原生请求失败：${error instanceof Error ? error.message : String(error)}` } });
            }
        }

        const upstreamUrl = buildUpstreamUrl(channel.base_url, req.path.replace(/^\/v1/, ""));
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(req.headers)) {
            if (!value || ["host", "content-length", "connection", "transfer-encoding", "expect", MODEL_CAPABILITY_HEADER].includes(key)) continue;
            headers[key] = Array.isArray(value) ? value.join(", ") : String(value);
        }
        headers.authorization = `Bearer ${decryptSecret(channel.key_ciphertext)}`;

        let upstream: globalThis.Response;
        try {
            upstream = (await fetch(upstreamUrl, {
                method: req.method,
                headers,
                body: ["GET", "HEAD"].includes(req.method) ? undefined : (raw as unknown as BodyInit),
            })) as globalThis.Response;
        } catch (error) {
            return void res.status(502).json({ error: `上游请求失败：${error instanceof Error ? error.message : String(error)}` });
        }

        const responseBody = Buffer.from(await upstream.arrayBuffer());
        const contentTypeHeader = upstream.headers.get("content-type") || "";
        res.status(upstream.status);
        if (contentTypeHeader) res.setHeader("content-type", contentTypeHeader);

        const isVideoSubmit = req.method === "POST" && req.path.includes("/v1/videos") && !req.path.includes("/videos/");
        if (isVideoSubmit && contentTypeHeader.includes("application/json")) {
            try {
                const parsed = JSON.parse(responseBody.toString("utf8")) as { id?: string; task_id?: string; status?: string };
                const upstreamTaskId = parsed.task_id || parsed.id;
                if (upstreamTaskId) {
                    const user = res.locals.user;
                    const taskId = `gt-${crypto.randomUUID()}`;
                    const task: GatewayTask = {
                        task_id: taskId,
                        user_id: user.id,
                        channel_id: channel.id,
                        model_id: model.id,
                        upstream_task_id: upstreamTaskId,
                        capability: model.capability,
                    };
                    memoryTasks.set(taskId, task);
                    try {
                        await admin.from("gouyingai_gateway_tasks").upsert(task);
                    } catch {
                        // in-memory fallback keeps polling working until restart
                    }
                    if (parsed.task_id) parsed.task_id = taskId;
                    else parsed.id = taskId;
                    res.json(parsed);
                    void recordUsage(admin, user.id, model.id, model.capability, upstream.status, 0);
                    return;
                }
            } catch {
                // fall through and return the upstream body as-is
            }
        }

        res.send(responseBody);
        void recordUsage(admin, res.locals.user.id, model.id, model.capability, upstream.status, 0);
    });

    const adminRouter = express.Router();
    adminRouter.use(requireAuth, requireAdmin);
    registerAdminRoutes(adminRouter, admin);
    app.use("/", adminRouter);

    app.use(gatewayCorsErrorHandler);
    app.use((_req, res) => res.status(404).json({ error: "not found" }));
    return app;
}

async function recordUsage(admin: SupabaseClient, userId: string, modelId: string, capability: string, status: number, tokens: number) {
    try {
        await admin.from("gouyingai_usage").insert({ user_id: userId, model_id: modelId, capability, status: String(status), tokens });
    } catch {
        // usage logging must never break a generation request
    }
}
