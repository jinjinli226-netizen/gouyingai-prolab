import cors from "cors";
import express, { type Request, type Response } from "express";

import { buildAutoDlWorkflowRequest, parseUnifiedVideoInput, queryAutoDlWorkflow, submitAutoDlWorkflow } from "./autodl-comfyui.js";
import { createLocalCanvasArtifactRouter } from "./canvas-artifact-routes.js";
import { createLocalCanvasJobRepository } from "./canvas-job-repository.js";
import { createCanvasJobRouter } from "./canvas-job-routes.js";
import { createLocalViralBatchRepository } from "./viral-batch-repository.js";
import { createViralBatchRouter } from "./viral-batch-routes.js";
import { createLocalUniversalCompositionPort, createLocalUniversalRemakeRepository, createUniversalRemakeRouter, UniversalRemakeCoordinator } from "./universal-viral-remake/index.js";
import { gatewayCorsErrorHandler, gatewayCorsOptions } from "./cors.js";
import { buildUpstreamUrl, extractModelNameFromJson, extractModelNameFromMultipart, MODEL_CAPABILITY_HEADER, parseModelCapability, pickChannelById, pickModelByName, toPublicModel, unambiguousPublishedModels } from "./catalog.js";
import { decryptSecret, encryptSecret, isEncryptedSecret, maskSecret } from "./encryption.js";
import { forwardGeminiChatCompletion } from "./gemini-chat-adapter.js";
import { LocalStore } from "./local-store.js";
import type { GatewayTask } from "./types.js";

export function createLocalGatewayApp(store: LocalStore) {
    const app = express();
    app.disable("x-powered-by");
    app.use(cors(gatewayCorsOptions(process.env, true)));
    app.use(express.json({ limit: "30mb" }));

    app.get("/health", (_req, res) => res.json({ ok: true, mode: "local" }));

    app.get("/v1/models", (req: Request, res: Response) => {
        res.set("Cache-Control", "no-store");
        const capability = String(req.query.capability || "");
        const channels = store.listChannels();
        const enabledChannelIds = new Set(channels.filter((channel) => channel.enabled).map((channel) => channel.id));
        const models = unambiguousPublishedModels(store.listModels().filter((model) => enabledChannelIds.has(model.channel_id))).filter((model) => !capability || model.capability === capability);
        res.json({ data: models.map((model) => toPublicModel(model, channels.find((channel) => channel.id === model.channel_id))) });
    });

    app.use("/v1/canvas-artifacts", createLocalCanvasArtifactRouter(store));
    const canvasJobs = createLocalCanvasJobRepository(store);
    app.use("/v1/canvas-jobs", createCanvasJobRouter(canvasJobs, () => "local"));
    app.use("/v1/viral-batches", createViralBatchRouter(createLocalViralBatchRepository(store), canvasJobs, () => "local"));
    const universalRemakeRuns = createLocalUniversalRemakeRepository(store);
    const universalRemakeCoordinator = new UniversalRemakeCoordinator(universalRemakeRuns, canvasJobs, createLocalUniversalCompositionPort(store));
    universalRemakeCoordinator.start();
    app.use("/v1/universal-remake-runs", createUniversalRemakeRouter(universalRemakeRuns, universalRemakeCoordinator, () => "local"));

    app.all("/v1/*splat", express.raw({ type: () => true, limit: "100mb" }), async (req: Request, res: Response) => {
        const videoTaskMatch = req.path.match(/^\/v1\/videos\/([^/]+)(?:\/content)?$/);
        if (req.method === "GET" && videoTaskMatch) {
            const task = store.getTask(videoTaskMatch[1]);
            if (task && task.user_id === "local" && task.capability === "video") {
                const channel = store.getChannel(task.channel_id);
                if (channel) {
                    if (channel.api_format === "autodl_comfyui") {
                        const { response: poll, task: state } = await queryAutoDlWorkflow(channel.base_url, decryptSecret(channel.key_ciphertext), task.upstream_task_id);
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
                    const pollUrl = buildUpstreamUrl(channel.base_url, upstreamPath);
                    const poll = await fetch(pollUrl, { method: "GET", headers: { authorization: `Bearer ${decryptSecret(channel.key_ciphertext)}` } });
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

        const model = pickModelByName(store.listModels(), modelName);
        if (!model) return void res.status(404).json({ error: `模型 ${modelName} 未发布或不存在` });
        const requestedCapability = parseModelCapability(req.headers[MODEL_CAPABILITY_HEADER]);
        if (!requestedCapability) return void res.status(400).json({ error: "请求缺少有效的模型能力声明" });
        if (model.capability !== requestedCapability) return void res.status(409).json({ error: `模型 ${modelName} 不支持 ${requestedCapability} 请求` });
        const channel = pickChannelById(store.listChannels(), model.channel_id);
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
            const taskId = `gt-${crypto.randomUUID()}`;
            store.saveTask({
                task_id: taskId,
                user_id: "local",
                channel_id: channel.id,
                model_id: model.id,
                upstream_task_id: normalized.upstreamTaskId,
                capability: model.capability,
            });
            store.addUsage({ user_id: "local", model_id: model.id, capability: model.capability, status: String(upstream.status), tokens: 0 });
            return void res.json({ id: taskId, status: normalized.status });
        }

        if (channel.api_format === "gemini" && req.method === "POST" && req.path === "/v1/chat/completions") {
            try {
                const result = await forwardGeminiChatCompletion(raw, channel, model.model_name, decryptSecret(channel.key_ciphertext));
                store.addUsage({ user_id: "local", model_id: model.id, capability: model.capability, status: String(result.status), tokens: 0 });
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
            const cause = (error as { cause?: { code?: string; message?: string } }).cause;
            const detail = cause ? `${cause.code || ""} ${cause.message || ""}`.trim() : "";
            console.error(`[gateway] upstream ${upstreamUrl} failed: ${error instanceof Error ? error.message : String(error)}${detail ? ` (${detail})` : ""}`);
            return void res.status(502).json({ error: `上游请求失败${detail ? `：${detail}` : ""}` });
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
                    const taskId = `gt-${crypto.randomUUID()}`;
                    const task: GatewayTask = {
                        task_id: taskId,
                        user_id: "local",
                        channel_id: channel.id,
                        model_id: model.id,
                        upstream_task_id: upstreamTaskId,
                        capability: model.capability,
                    };
                    store.saveTask(task);
                    if (parsed.task_id) parsed.task_id = taskId;
                    else parsed.id = taskId;
                    res.json(parsed);
                    store.addUsage({ user_id: "local", model_id: model.id, capability: model.capability, status: String(upstream.status), tokens: 0 });
                    return;
                }
            } catch {
                // fall through
            }
        }

        res.send(responseBody);
        store.addUsage({ user_id: "local", model_id: model.id, capability: model.capability, status: String(upstream.status), tokens: 0 });
    });

    app.get("/admin/channels", (_req, res) => res.json({ data: store.listChannels().map((channel) => ({ ...channel, key_ciphertext: maskSecret(channel.key_ciphertext) })) }));

    app.post("/admin/channels", (req, res) => {
        const { name, base_url, api_format = "openai", api_key = "", enabled = true } = req.body || {};
        if (!String(name || "").trim() || !String(base_url || "").trim()) return void res.status(400).json({ error: "渠道名称和 Base URL 必填" });
        const channel = store.createChannel({
            name: String(name).trim(),
            base_url: String(base_url).trim(),
            api_format,
            key_ciphertext: api_key ? encryptSecret(String(api_key)) : "",
            enabled: Boolean(enabled),
        });
        res.json({ data: { ...channel, key_ciphertext: maskSecret(channel.key_ciphertext) } });
    });

    app.patch("/admin/channels/:id", (req, res) => {
        const patch: Record<string, unknown> = {};
        if (req.body?.name) patch.name = String(req.body.name).trim();
        if (req.body?.base_url) patch.base_url = String(req.body.base_url).trim();
        if (req.body?.api_format) patch.api_format = req.body.api_format;
        if (typeof req.body?.enabled === "boolean") patch.enabled = req.body.enabled;
        if (req.body?.api_key) patch.key_ciphertext = encryptSecret(String(req.body.api_key));
        const channel = store.updateChannel(req.params.id, patch);
        if (!channel) return void res.status(404).json({ error: "渠道不存在" });
        res.json({ data: { ...channel, key_ciphertext: maskSecret(channel.key_ciphertext) } });
    });

    app.delete("/admin/channels/:id", (req, res) => {
        store.deleteChannel(req.params.id);
        res.json({ ok: true });
    });

    app.get("/admin/models", (_req, res) => {
        const channels = new Map(store.listChannels().map((channel) => [channel.id, { name: channel.name, base_url: channel.base_url }]));
        res.json({ data: store.listModels().map((model) => ({ ...model, gouyingai_channels: channels.get(model.channel_id) })) });
    });

    app.post("/admin/models", (req, res) => {
        const { channel_id, model_name, display_name, capability, api_format = "openai", published = true, sort_order = 0, options = {} } = req.body || {};
        if (!channel_id || !String(model_name || "").trim() || !String(display_name || "").trim() || !capability) {
            return void res.status(400).json({ error: "渠道、模型名、展示名和能力必填" });
        }
        const model = store.createModel({ channel_id, model_name: String(model_name).trim(), display_name: String(display_name).trim(), capability, api_format, published, sort_order, options });
        res.json({ data: model });
    });

    app.patch("/admin/models/:id", (req, res) => {
        const model = store.updateModel(req.params.id, req.body || {});
        if (!model) return void res.status(404).json({ error: "模型不存在" });
        res.json({ data: model });
    });

    app.delete("/admin/models/:id", (req, res) => {
        store.deleteModel(req.params.id);
        res.json({ ok: true });
    });

    app.get("/admin/usage", (req, res) => {
        const limit = Math.min(Number(req.query.limit) || 100, 500);
        res.json({ data: store.listUsage(limit) });
    });

    app.use(gatewayCorsErrorHandler);
    app.use((_req, res) => res.status(404).json({ error: "not found" }));
    return app;
}

export { isEncryptedSecret };
