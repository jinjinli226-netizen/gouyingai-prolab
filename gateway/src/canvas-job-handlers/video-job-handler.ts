import { createHash, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import type { SupabaseClient } from "@supabase/supabase-js";

import { buildAutoDlWorkflowRequest, queryAutoDlWorkflow, submitAutoDlWorkflow } from "../autodl-comfyui.js";
import { canvasArtifactStoragePath, isOwnedCanvasArtifactPath } from "../canvas-artifact-routes.js";
import { buildUpstreamUrl } from "../catalog.js";
import type { CanvasJobHandler } from "../canvas-job-runner.js";
import { decryptSecret } from "../encryption.js";
import type { LocalStore } from "../local-store.js";
import type { Channel, Model } from "../types.js";

export type CanvasVideoResult = {
    url: string;
    mimeType?: string;
    storageKey?: string;
};

export type CanvasVideoUpstreamState =
    | { status: "pending"; upstreamTaskId?: string }
    | { status: "completed"; upstreamTaskId?: string; result: CanvasVideoResult }
    | { status: "failed"; upstreamTaskId?: string; error: string };

export type CanvasVideoJobRuntime = {
    loadModel: (modelId: string) => Promise<Model | null>;
    loadChannel: (channelId: string) => Promise<Channel | null>;
    submit: (input: { job: Parameters<CanvasJobHandler>[0]["job"]; model: Model; channel: Channel }) => Promise<CanvasVideoUpstreamState>;
    poll: (input: { job: Parameters<CanvasJobHandler>[0]["job"]; model: Model; channel: Channel; upstreamTaskId: string }) => Promise<CanvasVideoUpstreamState>;
    sleep?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
    pollIntervalMs?: number;
    maxPollAttempts?: number;
    isGenerationCurrent?: (job: Parameters<CanvasJobHandler>[0]["job"]) => Promise<boolean>;
    saveResult?: (input: { job: Parameters<CanvasJobHandler>[0]["job"]; channel: Channel; result: CanvasVideoResult; signal: AbortSignal }) => Promise<CanvasVideoResult>;
};

export function createVideoJobHandler(runtime: CanvasVideoJobRuntime): CanvasJobHandler {
    return async ({ job, signal, update }) => {
        if (job.kind !== "video" && job.kind !== "viral-video") throw new Error(`任务 ${job.id} 不是视频任务`);
        if (!job.model_id || !job.channel_id) throw new Error("视频任务缺少固定的模型或渠道绑定");
        const [model, channel] = await Promise.all([runtime.loadModel(job.model_id), runtime.loadChannel(job.channel_id)]);
        if (!model || !channel || model.capability !== "video" || !model.published || !channel.enabled || model.channel_id !== channel.id) {
            throw new Error("视频任务的模型/渠道路由绑定已失效");
        }

        let upstreamTaskId = job.upstream_task_id;
        let state: CanvasVideoUpstreamState | null = null;
        if (!upstreamTaskId) {
            state = await runtime.submit({ job, model, channel });
            upstreamTaskId = state.upstreamTaskId || null;
            if (upstreamTaskId) {
                await update({ upstream_task_id: upstreamTaskId, status: "running" });
            }
        }

        if (state?.status === "failed") throw new Error(state.error);
        if (state?.status !== "completed") {
            if (!upstreamTaskId) throw new Error("视频上游没有返回任务 ID 或结果");
            const attempts = Math.max(1, runtime.maxPollAttempts || 480);
            for (let attempt = 0; attempt < attempts; attempt += 1) {
                if (signal.aborted) throw new Error("视频任务执行已停止");
                state = await runtime.poll({ job: { ...job, upstream_task_id: upstreamTaskId }, model, channel, upstreamTaskId });
                if (state.status === "completed") break;
                if (state.status === "failed") throw new Error(state.error);
                if (attempt === attempts - 1) throw new Error("视频生成超时，请稍后重试");
                await (runtime.sleep || delay)(runtime.pollIntervalMs || 2_500, signal);
            }
        }

        if (!state || state.status !== "completed") throw new Error("视频任务没有生成结果");
        const storedResult = runtime.saveResult ? await runtime.saveResult({ job, channel, result: state.result, signal }) : state.result;
        const mounted = runtime.isGenerationCurrent ? await runtime.isGenerationCurrent(job) : true;
        const result = { ...storedResult, mimeType: storedResult.mimeType || "video/mp4", mounted };
        return {
            result,
            result_patch: mounted
                ? {
                      canvasId: job.canvas_id,
                      nodeId: job.target_node_id,
                      jobId: job.id,
                      generationRevision: job.generation_revision,
                      nodePatch: {
                          metadata: {
                              content: storedResult.url,
                              ...(storedResult.storageKey ? { storageKey: storedResult.storageKey } : {}),
                              mimeType: storedResult.mimeType || "video/mp4",
                              status: "success",
                              errorDetails: undefined,
                          },
                      },
                  }
                : null,
        };
    };
}

export function createLocalVideoJobRuntime(store: LocalStore, overrides: Partial<CanvasVideoJobRuntime> = {}): CanvasVideoJobRuntime {
    const publicBaseUrl = (process.env.GATEWAY_PUBLIC_URL || `http://127.0.0.1:${Number(process.env.PORT) || 8788}`).replace(/\/+$/, "");
    return {
        loadModel: async (modelId) => store.listModels().find((model) => model.id === modelId) || null,
        loadChannel: async (channelId) => store.getChannel(channelId) || null,
        submit: (context) => submitConfiguredVideo(context, async (job, uri) => {
            const artifact = store.readCanvasArtifact(job.user_id, job.canvas_id, uri);
            if (!artifact) throw new Error("视频参考素材不存在或无权访问");
            return `data:${artifact.mime_type};base64,${artifact.bytes.toString("base64")}`;
        }),
        poll: pollConfiguredVideo,
        saveResult: async ({ job, channel, result, signal }) => {
            if (result.storageKey?.startsWith("canvas-artifact:")) return result;
            const downloaded = await downloadVideoResult(channel, result, signal);
            const checksum = createHash("sha256").update(downloaded.bytes).digest("hex");
            const artifact = store.saveCanvasArtifact(job.user_id, job.canvas_id, { name: "generated-video.mp4", mimeType: downloaded.mimeType, bytes: downloaded.bytes, checksum });
            const query = new URLSearchParams({ canvasId: job.canvas_id, uri: artifact.uri });
            return { url: `${publicBaseUrl}/v1/canvas-artifacts/content?${query}`, storageKey: artifact.uri, mimeType: downloaded.mimeType };
        },
        isGenerationCurrent: async (job) => !store.listCanvasJobs(job.user_id, { canvasId: job.canvas_id }).some((candidate) => candidate.target_node_id === job.target_node_id && candidate.generation_revision > job.generation_revision),
        ...overrides,
    };
}

export function createSupabaseVideoJobRuntime(admin: SupabaseClient, overrides: Partial<CanvasVideoJobRuntime> = {}): CanvasVideoJobRuntime {
    return {
        loadModel: async (modelId) => {
            const { data, error } = await admin.from("gouyingai_models").select("*").eq("id", modelId).maybeSingle();
            if (error) throw new Error(error.message);
            return (data as Model | null) || null;
        },
        loadChannel: async (channelId) => {
            const { data, error } = await admin.from("gouyingai_channels").select("*").eq("id", channelId).maybeSingle();
            if (error) throw new Error(error.message);
            return (data as Channel | null) || null;
        },
        submit: (context) => submitConfiguredVideo(context, async (job, uri) => {
            const path = canvasArtifactStoragePath(uri);
            if (!isOwnedCanvasArtifactPath(job.user_id, job.canvas_id, path)) throw new Error("视频参考素材不存在或无权访问");
            const { data, error } = await admin.storage.from("gouyingai-media").download(path);
            if (error || !data) throw new Error(error?.message || "视频参考素材下载失败");
            return `data:${data.type || "application/octet-stream"};base64,${Buffer.from(await data.arrayBuffer()).toString("base64")}`;
        }),
        poll: pollConfiguredVideo,
        saveResult: async ({ job, channel, result, signal }) => {
            if (result.storageKey?.startsWith("canvas-artifact:")) return result;
            const downloaded = await downloadVideoResult(channel, result, signal);
            const path = `${encodeURIComponent(job.user_id)}/canvas/${encodeURIComponent(job.canvas_id)}/outputs/${job.id}/${randomUUID()}-generated-video.mp4`;
            const bucket = admin.storage.from("gouyingai-media");
            const uploaded = await bucket.upload(path, downloaded.bytes, { contentType: downloaded.mimeType, upsert: false });
            if (uploaded.error) throw new Error(uploaded.error.message);
            const signed = await bucket.createSignedUrl(path, 7 * 24 * 60 * 60);
            if (signed.error || !signed.data?.signedUrl) throw new Error(signed.error?.message || "视频结果签名失败");
            return { url: signed.data.signedUrl, storageKey: `canvas-artifact:${path}`, mimeType: downloaded.mimeType };
        },
        isGenerationCurrent: async (job) => {
            const { data, error } = await admin
                .from("gouyingai_canvas_jobs")
                .select("id")
                .eq("user_id", job.user_id)
                .eq("canvas_id", job.canvas_id)
                .eq("target_node_id", job.target_node_id)
                .gt("generation_revision", job.generation_revision)
                .limit(1);
            if (error) throw new Error(error.message);
            return !data?.length;
        },
        ...overrides,
    };
}

type ArtifactResolver = (job: Parameters<CanvasJobHandler>[0]["job"], uri: string) => Promise<string>;

async function submitConfiguredVideo({ job, model, channel }: { job: Parameters<CanvasJobHandler>[0]["job"]; model: Model; channel: Channel }, resolveArtifact?: ArtifactResolver): Promise<CanvasVideoUpstreamState> {
    const input = await resolveVideoInputArtifacts(job, normalizeVideoInput(job.input), resolveArtifact);
    if (channel.api_format === "autodl_comfyui") {
        const workflow = buildAutoDlWorkflowRequest(model.options || {}, input);
        const { response, task } = await submitAutoDlWorkflow(channel.base_url, decryptSecret(channel.key_ciphertext), workflow);
        if (!response.ok || task.status === "failed") return { status: "failed", upstreamTaskId: task.upstreamTaskId, error: task.error || `AutoDL 视频提交失败（${response.status}）` };
        if (task.status === "completed" && task.resultUrl) return { status: "completed", upstreamTaskId: task.upstreamTaskId, result: { url: task.resultUrl, mimeType: "video/mp4" } };
        return { status: "pending", upstreamTaskId: task.upstreamTaskId };
    }

    let response: globalThis.Response;
    try {
        response = await fetch(buildUpstreamUrl(channel.base_url, "/videos"), {
            method: "POST",
            headers: { authorization: `Bearer ${decryptSecret(channel.key_ciphertext)}` },
            body: await buildVideoForm(model.model_name, input),
        });
    } catch (error) {
        throw new Error(`上游提交结果未知：${error instanceof Error ? error.message : String(error)}`);
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok) return { status: "failed", error: readUpstreamError(payload) || `视频提交失败（${response.status}）` };
    return normalizeVideoState(payload);
}

async function resolveVideoInputArtifacts(job: Parameters<CanvasJobHandler>[0]["job"], input: NormalizedVideoInput, resolveArtifact?: ArtifactResolver) {
    const resolveValues = (values: string[]) => Promise.all(values.map((value) => {
        if (!value.startsWith("canvas-artifact:")) throw new Error("后台任务只接受已上传到当前画布的私有参考素材");
        return resolveArtifact ? resolveArtifact(job, value) : Promise.reject(new Error("Gateway 没有配置画布素材解析器"));
    }));
    const [referenceImages, referenceVideos, referenceAudios] = await Promise.all([resolveValues(input.referenceImages), resolveValues(input.referenceVideos), resolveValues(input.referenceAudios)]);
    return { ...input, referenceImages, referenceVideos, referenceAudios };
}

async function pollConfiguredVideo({ channel, upstreamTaskId }: { channel: Channel; upstreamTaskId: string }): Promise<CanvasVideoUpstreamState> {
    if (channel.api_format === "autodl_comfyui") {
        const { response, task } = await queryAutoDlWorkflow(channel.base_url, decryptSecret(channel.key_ciphertext), upstreamTaskId);
        if (!response.ok || task.status === "failed") return { status: "failed", upstreamTaskId, error: task.error || `AutoDL 视频查询失败（${response.status}）` };
        if (task.status === "completed" && task.resultUrl) return { status: "completed", upstreamTaskId, result: { url: task.resultUrl, mimeType: "video/mp4" } };
        return { status: "pending", upstreamTaskId };
    }
    const response = await fetch(buildUpstreamUrl(channel.base_url, `/videos/${encodeURIComponent(upstreamTaskId)}`), {
        headers: { authorization: `Bearer ${decryptSecret(channel.key_ciphertext)}` },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return { status: "failed", upstreamTaskId, error: readUpstreamError(payload) || `视频查询失败（${response.status}）` };
    return normalizeVideoState(payload, upstreamTaskId);
}

type NormalizedVideoInput = {
    prompt: string;
    duration: string;
    resolution: string;
    size: string;
    referenceImages: string[];
    referenceVideos: string[];
    referenceAudios: string[];
    generateAudio: boolean;
    watermark: boolean;
};

function normalizeVideoInput(input: Record<string, unknown>): NormalizedVideoInput {
    return {
        prompt: stringValue(input.prompt),
        duration: stringValue(input.seconds || input.duration || "6"),
        resolution: normalizeVideoResolution(stringValue(input.resolution || input.resolution_name || "768p")),
        size: stringValue(input.size || "1280x720"),
        referenceImages: stringList(input.referenceImages || input.reference_images),
        referenceVideos: stringList(input.referenceVideos || input.reference_videos),
        referenceAudios: stringList(input.referenceAudios || input.reference_audios),
        generateAudio: booleanValue(input.generateAudio ?? input.generate_audio, true),
        watermark: booleanValue(input.watermark, false),
    };
}

function normalizeVideoResolution(value: string) {
    if (value === "low") return "480p";
    if (["auto", "high", "medium"].includes(value)) return "768p";
    const resolution = value.replace(/p$/i, "") || "768";
    return `${resolution}p`;
}

async function buildVideoForm(modelName: string, input: NormalizedVideoInput) {
    const form = new FormData();
    form.append("model", modelName);
    form.append("prompt", input.prompt);
    form.append("seconds", input.duration);
    form.append("resolution_name", input.resolution);
    form.append("size", input.size);
    form.append("preset", "normal");
    form.append("generate_audio", String(input.generateAudio));
    form.append("watermark", String(input.watermark));
    const referenceImageField = /minimax-h3/i.test(modelName) ? "reference_images" : "input_reference";
    for (const [index, value] of input.referenceImages.entries()) form.append(referenceImageField, dataUrlFile(value, `reference-${index}`) || value);
    for (const [index, value] of input.referenceVideos.entries()) form.append("reference_videos", dataUrlFile(value, `reference-video-${index}`) || value);
    for (const [index, value] of input.referenceAudios.entries()) form.append("reference_audios", dataUrlFile(value, `reference-audio-${index}`) || value);
    return form;
}

function dataUrlFile(value: string, name: string) {
    const match = value.match(/^data:([^;,]+)?;base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return null;
    return new File([Buffer.from(match[2], "base64")], name, { type: match[1] || "application/octet-stream" });
}

function normalizeVideoState(payload: unknown, fallbackTaskId?: string): CanvasVideoUpstreamState {
    const envelope = objectValue(payload);
    const data = objectValue(envelope.data);
    const value = Object.keys(data).length && (data.id || data.task_id || data.status || data.url || data.video_url || data.result_url) ? data : envelope;
    const upstreamTaskId = stringValue(value.task_id || value.id || fallbackTaskId) || undefined;
    const status = stringValue(value.status).toLowerCase();
    const url = firstString(value.video_url, value.result_url, value.url, objectValue(value.content).video_url, objectValue(value.content).url);
    if (url) return { status: "completed", upstreamTaskId, result: { url, mimeType: "video/mp4" } };
    if (["failed", "failure", "cancelled", "canceled", "expired"].includes(status)) return { status: "failed", upstreamTaskId, error: readUpstreamError(value) || "视频生成失败" };
    if (["completed", "succeeded", "success"].includes(status)) return { status: "failed", upstreamTaskId, error: "视频任务成功但没有返回视频 URL" };
    if (upstreamTaskId) return { status: "pending", upstreamTaskId };
    return { status: "failed", error: readUpstreamError(value) || "视频接口没有返回任务 ID" };
}

async function downloadVideoResult(channel: Channel, result: CanvasVideoResult, signal: AbortSignal) {
    let url: URL;
    try {
        url = new URL(result.url, `${channel.base_url.replace(/\/+$/, "")}/`);
    } catch {
        throw new Error("视频结果地址无效，无法持久化");
    }
    const channelOrigin = new URL(channel.base_url).origin;
    await assertSafeVideoResultUrl(url, channelOrigin);
    let response = await fetch(url, { signal });
    if (!response.ok && url.origin === channelOrigin && [401, 403].includes(response.status)) {
        response = await fetch(url, { headers: { authorization: `Bearer ${decryptSecret(channel.key_ciphertext)}` }, signal });
    }
    if (!response.ok) throw new Error(`视频结果转存失败（${response.status}）`);
    const bytes = await readResponseBytes(response, 500 * 1024 * 1024);
    if (!bytes.length) throw new Error("视频结果为空，无法持久化");
    return { bytes, mimeType: response.headers.get("content-type") || result.mimeType || "video/mp4" };
}

async function assertSafeVideoResultUrl(url: URL, channelOrigin: string) {
    if (url.origin === channelOrigin) return;
    if (url.protocol !== "https:") throw new Error("视频结果地址必须使用 HTTPS");
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    const addresses = isIP(hostname) ? [hostname] : (await lookup(hostname, { all: true })).map((entry) => entry.address);
    if (!addresses.length || addresses.some(isPrivateAddress)) throw new Error("视频结果地址指向了不允许访问的内网地址");
}

function isPrivateAddress(address: string) {
    const normalized = address.toLowerCase();
    if (normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
    const ipv4 = normalized.startsWith("::ffff:") ? normalized.slice(7) : normalized;
    const parts = ipv4.split(".").map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
    return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168);
}

async function readResponseBytes(response: Response, limit: number) {
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > limit) throw new Error("视频结果超过 500MB 存储上限");
    if (!response.body) return Buffer.from(await response.arrayBuffer());
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > limit) {
            await reader.cancel();
            throw new Error("视频结果超过 500MB 存储上限");
        }
        chunks.push(value);
    }
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total);
}

function readUpstreamError(payload: unknown) {
    const value = objectValue(payload);
    const error = value.error;
    return firstString(value.message, value.msg, typeof error === "string" ? error : objectValue(error).message);
}

function objectValue(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown) {
    return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

function stringList(value: unknown) {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item)) : [];
}

function booleanValue(value: unknown, fallback: boolean) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value.toLowerCase() === "true" ? true : value.toLowerCase() === "false" ? false : fallback;
    return fallback;
}

function firstString(...values: unknown[]) {
    return values.find((value): value is string => typeof value === "string" && Boolean(value)) || "";
}

function delay(milliseconds: number, signal: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        if (signal.aborted) return void reject(new Error("视频任务执行已停止"));
        const timer = setTimeout(resolve, milliseconds);
        signal.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new Error("视频任务执行已停止"));
        }, { once: true });
    });
}
