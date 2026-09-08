import { browserProxyBaseUrl, normalizeBaseUrl } from "./constants";
import { buildDalleEndpointBody, detectModelFamily } from "./image-body-builder";
import { inferModelInfo } from "./model-inference";
import type { ApiFormat, GrokVideoParams, ImageModelParams } from "./types";

type BuildRequestOptions = {
    operation?: "generate" | "edit";
    modelId: string;
    prompt: string;
    images?: string[];
    imageFiles?: Blob[];
    mask?: Blob;
    modelParams?: ImageModelParams | GrokVideoParams | Record<string, unknown>;
    baseUrl: string;
    apiKey: string;
};

type ParsedResource = {
    resourceUrl?: string;
    resources?: string[];
    error?: string;
};

export type ProviderRequest = {
    url: string;
    init: RequestInit;
    apiFormat: ApiFormat;
    parseResponse: (resp: Response) => Promise<ParsedResource>;
};

export function buildRequest(opts: BuildRequestOptions): ProviderRequest {
    const info = inferModelInfo(opts.modelId);
    const apiFormat = info.apiFormat;
    if (apiFormat === "dalle") return opts.operation === "edit" ? buildDalleEditRequest(opts, apiFormat) : buildDalleRequest(opts, apiFormat);
    if (apiFormat === "openai-video" && isGrokImagineVideo(opts.modelId)) return buildOpenAIGrokVideoRequest(opts, apiFormat);
    if (apiFormat === "grok-video-chat") return buildGrokVideoChatRequest(opts, apiFormat);
    if (apiFormat === "mj-proxy" || apiFormat === "koukoutu" || apiFormat === "video-unified") {
        throw new Error(`${apiFormat} 暂未在浏览器直连模式支持`);
    }
    throw new Error(`${apiFormat} 暂未接入当前 provider adapter`);
}

export function isGrokImagineVideo(modelId: string) {
    // 兼容两种拼写：grok-imagine-video（官方）与 grok-image-video（部分聚合商命名）
    return /grok.*imag(?:e|ine).*video/i.test(modelId);
}

function buildDalleRequest(opts: BuildRequestOptions, apiFormat: ApiFormat): ProviderRequest {
    return {
        apiFormat,
        url: apiUrl(opts.baseUrl, "/images/generations"),
        init: {
            method: "POST",
            headers: jsonHeaders(opts.apiKey),
            body: JSON.stringify(
                buildDalleEndpointBody({
                    modelName: opts.modelId,
                    prompt: opts.prompt,
                    modelParams: opts.modelParams as ImageModelParams | undefined,
                    responseFormat: "b64_json",
                }),
            ),
        },
        parseResponse: parseImageResponse,
    };
}

function buildDalleEditRequest(opts: BuildRequestOptions, apiFormat: ApiFormat): ProviderRequest {
    const imageFiles = opts.imageFiles || [];
    if (!imageFiles.length) throw new Error("请先添加参考图");
    if (opts.mask && !supportsImageMask(opts.modelId)) {
        throw new Error(`${opts.modelId} 暂不支持蒙版编辑，请移除蒙版或切换 GPT Image / DALL-E 编辑模型`);
    }
    const form = new FormData();
    const body = buildDalleEndpointBody({
        modelName: opts.modelId,
        prompt: opts.prompt,
        modelParams: opts.modelParams as ImageModelParams | undefined,
        responseFormat: "b64_json",
    });
    appendFormFields(form, body);
    // 多图融合走 OpenAI 数组字段 image[]（gpt-image 系列最多 16 张）；单图保持 image 以兼容 dall-e-2 等只认单字段的模型。
    // 用同名 image 重复 append 会被 newapi 网关按非数组解析，多图时固定返回 422 Unprocessable Content。
    const imageField = imageFiles.length > 1 ? "image[]" : "image";
    for (const file of imageFiles) form.append(imageField, file);
    if (opts.mask) form.append("mask", opts.mask);
    return {
        apiFormat,
        url: apiUrl(opts.baseUrl, "/images/edits"),
        init: {
            method: "POST",
            headers: authHeaders(opts.apiKey),
            body: form,
        },
        parseResponse: parseImageResponse,
    };
}

function buildOpenAIGrokVideoRequest(opts: BuildRequestOptions, apiFormat: ApiFormat): ProviderRequest {
    const params = opts.modelParams as GrokVideoParams | undefined;
    const seconds = params?.duration ?? 6;
    if (![6, 10, 12, 16, 20].includes(seconds)) throw new Error("grok-imagine-video 只支持 6、10、12、16 或 20 秒");
    if (params?.size && !["720x1280", "1280x720", "1024x1024", "1024x1792", "1792x1024"].includes(params.size)) {
        throw new Error("grok-imagine-video 不支持当前尺寸，请选择 720x1280、1280x720、1024x1024、1024x1792 或 1792x1024");
    }
    const images = (opts.images || []).filter(Boolean).slice(0, 7);
    const body: Record<string, unknown> = {
        model: opts.modelId,
        prompt: opts.prompt,
        seconds,
        ...(params?.size ? { size: params.size } : {}),
        ...(images.length ? { images } : {}),
    };
    return {
        apiFormat,
        url: apiUrl(opts.baseUrl, "/videos"),
        init: {
            method: "POST",
            headers: jsonHeaders(opts.apiKey),
            body: JSON.stringify(body),
        },
        parseResponse: parseVideoTaskResponse,
    };
}

function buildGrokVideoChatRequest(opts: BuildRequestOptions, apiFormat: ApiFormat): ProviderRequest {
    const params = opts.modelParams as GrokVideoParams | undefined;
    if (opts.images?.length) {
        throw new Error("grok-video-chat 暂不支持参考图，请移除参考图或切换 openai-video 协议模型");
    }
    const body: Record<string, unknown> = {
        model: opts.modelId,
        messages: [{ role: "user", content: opts.prompt }],
        stream: false,
        seconds: String(params?.duration ?? 6),
    };
    if (params?.size) body.size = params.size;
    if (params?.resolutionName) body.resolution_name = params.resolutionName;
    if (params?.preset) body.preset = params.preset;
    return {
        apiFormat,
        url: apiUrl(opts.baseUrl, "/chat/completions"),
        init: {
            method: "POST",
            headers: jsonHeaders(opts.apiKey),
            body: JSON.stringify(body),
        },
        parseResponse: parseGrokVideoChatResponse,
    };
}

function apiUrl(baseUrl: string, path: string) {
    const normalized = browserProxyBaseUrl(normalizeBaseUrl(baseUrl)).replace(/\/+$/, "");
    return `${normalized.endsWith("/v1") ? normalized : `${normalized}/v1`}${path}`;
}

function authHeaders(apiKey: string) {
    return { Authorization: `Bearer ${apiKey}` };
}

function jsonHeaders(apiKey: string) {
    return { ...authHeaders(apiKey), "Content-Type": "application/json" };
}

function supportsImageMask(modelId: string) {
    const family = detectModelFamily(modelId);
    return family === "dalle" || family === "gpt-image";
}

function appendFormFields(form: FormData, fields: Record<string, unknown>) {
    for (const [key, value] of Object.entries(fields)) {
        if (value === undefined || value === null || value === "") continue;
        form.append(key, typeof value === "string" || value instanceof Blob ? value : String(value));
    }
}

async function parseJsonResponse(resp: Response) {
    const payload = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
    const payloadError = readResponseError(payload, "");
    if (!resp.ok) return { payload, error: payloadError || resp.statusText };
    if (typeof payload.code === "number" && payload.code !== 0) return { payload, error: payloadError || "请求失败" };
    if (payload.success === false) return { payload, error: payloadError || "请求失败" };
    if (payload.error) return { payload, error: payloadError || "请求失败" };
    return { payload };
}

async function parseImageResponse(resp: Response): Promise<ParsedResource> {
    const { payload, error } = await parseJsonResponse(resp);
    if (error) return { error };
    const data = Array.isArray(payload.data) ? payload.data : [];
    const resources = data
        .map((item) => {
            const value = item as Record<string, unknown>;
            if (typeof value.b64_json === "string" && value.b64_json) return `data:image/png;base64,${value.b64_json}`;
            if (typeof value.url === "string" && value.url) return value.url;
            return "";
        })
        .filter(Boolean);
    if (resources.length) return { resourceUrl: resources[0], resources };
    return { error: "接口没有返回图片" };
}

async function parseVideoTaskResponse(resp: Response): Promise<ParsedResource> {
    const { payload, error } = await parseJsonResponse(resp);
    if (error) return { error };
    const data = (payload.data && typeof payload.data === "object" ? payload.data : payload) as Record<string, unknown>;
    if (typeof data.id === "string" && data.id) return { resourceUrl: data.id };
    if (typeof data.task_id === "string" && data.task_id) return { resourceUrl: data.task_id };
    if (typeof data.url === "string" && data.url) return { resourceUrl: data.url };
    return { error: "视频接口没有返回任务 ID" };
}

async function parseGrokVideoChatResponse(resp: Response): Promise<ParsedResource> {
    const { payload, error } = await parseJsonResponse(resp);
    if (error) return { error };
    const choices = Array.isArray(payload.choices) ? payload.choices : [];
    const first = choices[0] as Record<string, unknown> | undefined;
    const message = first?.message as Record<string, unknown> | undefined;
    const content = typeof message?.content === "string" ? message.content : "";
    const url = content.match(/https?:\/\/\S+/)?.[0]?.replace(/[)\].,，。]+$/, "");
    if (url) return { resourceUrl: url };
    return { error: content || "Grok 视频接口没有返回视频 URL" };
}

function readResponseError(payload: Record<string, unknown>, fallback: string) {
    const error = payload.error;
    if (error && typeof error === "object" && "message" in error) {
        const message = (error as { message?: unknown }).message;
        if (typeof message === "string" && message) return message;
    }
    if (typeof payload.msg === "string" && payload.msg) return payload.msg;
    if (typeof payload.message === "string" && payload.message) return payload.message;
    return fallback || "请求失败";
}
