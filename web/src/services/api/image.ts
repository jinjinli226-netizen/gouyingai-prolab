import axios from "axios";

import { buildApiUrl, modelCapabilityHeaders, resolveModelRequestConfigForCapability, withModelCapabilityHeader, type AiConfig } from "@/stores/use-config-store";
import { nanoid } from "nanoid";
import { dataUrlToFile } from "@/lib/image-utils";
import { buildImageReferencePromptText } from "@/lib/image-reference-prompt";
import { imageToDataUrl } from "@/services/image-storage";
import { inferModelInfo } from "@/lib/pro-spec/model-inference";
import { buildRequest } from "@/lib/pro-spec/provider-adapter";
import type { ImageModelParams } from "@/lib/pro-spec/types";
import type { ReferenceImage } from "@/types/image";

export type AiTextContentPart =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
    | { type: "video_url"; video_url: { url: string } };

export type AiTextMessage = {
    role: "system" | "user" | "assistant";
    content: string | AiTextContentPart[];
};

export type ResponseToolCall = {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
    thoughtSignature?: string;
};

export type ResponseInputMessage =
    | AiTextMessage
    | { type: "function_call"; call_id: string; name: string; arguments: string; thoughtSignature?: string }
    | { role: "tool"; tool_call_id: string; content: string };

export type ResponseFunctionTool = {
    type: "function";
    function: {
        name: string;
        description?: string;
        parameters: Record<string, unknown>;
        strict?: boolean;
    };
};

export type ToolResponseResult = {
    content: string;
    toolCalls: ResponseToolCall[];
};

type ToolChoice = "auto" | "required" | { type: "function"; name: string };
type ResponseMessageContent = AiTextMessage["content"] | string;
type ResponseInputContent = { type: "input_text"; text: string } | { type: "input_image"; image_url: string };
type ResponseInputItem =
    | { role: "system" | "user" | "assistant"; content: string | ResponseInputContent[] }
    | { type: "function_call"; call_id: string; name: string; arguments: string }
    | { type: "function_call_output"; call_id: string; output: string };
type ResponseApiToolDefinition = {
    type: "function";
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
    strict?: boolean;
};
type ResponseApiOutputItem =
    | { type?: "message"; content?: Array<{ type?: string; text?: string }> }
    | { type?: "function_call"; id?: string; call_id?: string; name?: string; arguments?: string };
type ResponseApiPayload = {
    id?: string;
    output?: ResponseApiOutputItem[];
    output_text?: string;
    error?: { message?: string };
    code?: number;
    msg?: string;
};
type ResponseStreamState = { buffer: string; text: string; payload?: ResponseApiPayload; error?: string };
type OpenAiChatToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type OpenAiChatMessage =
    | { role: "system" | "user" | "assistant"; content: string | AiTextContentPart[] }
    | { role: "assistant"; content: null; tool_calls: OpenAiChatToolCall[] }
    | { role: "tool"; tool_call_id: string; content: string };
type OpenAiChatPayload = {
    choices?: Array<{
        message?: { content?: string | null; tool_calls?: OpenAiChatToolCall[] };
        delta?: { content?: string | null; tool_calls?: Array<{ index?: number; id?: string; type?: "function"; function?: { name?: string; arguments?: string } }> };
    }>;
    error?: { message?: string };
    code?: number;
    msg?: string;
};
type OpenAiChatStreamState = {
    buffer: string;
    text: string;
    toolCalls: Map<number, OpenAiChatToolCall>;
    error?: string;
};

type ImageApiResponse = {
    data?: Array<Record<string, unknown>>;
    error?: { message?: string };
    code?: number;
    msg?: string;
};
type GeminiPart = {
    text?: string;
    inlineData?: { mimeType?: string; data?: string };
    inline_data?: { mime_type?: string; mimeType?: string; data?: string };
    fileData?: { mimeType?: string; fileUri?: string };
    functionCall?: { id?: string; name?: string; args?: Record<string, unknown> };
    functionResponse?: { id?: string; name?: string; response?: Record<string, unknown> };
    thoughtSignature?: string;
    thought_signature?: string;
};
type GeminiContent = { role?: "user" | "model"; parts: GeminiPart[] };
type GeminiPayload = {
    candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>;
    models?: Array<{ name?: string }>;
    error?: { message?: string };
    promptFeedback?: { blockReason?: string };
};
type GeminiStreamState = { buffer: string; text: string; toolCalls: ResponseToolCall[]; error?: string };
type RequestOptions = { signal?: AbortSignal };

const QUALITY_BASE: Record<string, number> = {
    low: 1024,
    medium: 2048,
    high: 2880,
    standard: 1024,
    hd: 2048,
};
const QUALITY_ALIASES: Record<string, string> = {
    "1k": "low",
    "2k": "medium",
    "4k": "high",
};
const DEFAULT_IMAGE_SHORT_SIDE = 1024;
const IMAGE_SIZE_STEP = 16;
const IMAGE_MIN_PIXELS = 655360;
const IMAGE_MAX_PIXELS = 8294400;
const IMAGE_MAX_EDGE = 3840;
const IMAGE_MAX_RATIO = 3;
const IMAGE_OUTPUT_FORMAT = "png";

const GEMINI_SUPPORTED_RATIOS = ["1:1", "1:4", "1:8", "2:3", "3:2", "3:4", "4:1", "4:3", "4:5", "5:4", "8:1", "9:16", "16:9", "21:9"];
const GEMINI_IMAGE_SIZE_BY_QUALITY: Record<string, string> = { low: "1K", medium: "2K", high: "4K", standard: "1K", hd: "2K" };

function normalizeQuality(quality: string) {
    const value = quality.trim().toLowerCase();
    const normalized = QUALITY_ALIASES[value] || value;
    return QUALITY_BASE[normalized] ? normalized : undefined;
}

/** Map "quality + ratio" to an explicit pixel dimension like "3840x2160". */
function resolveSize(quality: string | undefined, ratio: string): string {
    const parsedRatio = parseImageRatio(ratio);
    const basePixels = quality ? QUALITY_BASE[quality] : undefined;
    const isLandscape = parsedRatio.width >= parsedRatio.height;
    const longRatio = isLandscape ? parsedRatio.width / parsedRatio.height : parsedRatio.height / parsedRatio.width;
    let longSide: number;
    let shortSide: number;

    if (basePixels) {
        const targetPixels = basePixels * basePixels;
        const longSideRaw = Math.sqrt(targetPixels * longRatio);
        longSide = Math.floor(longSideRaw / IMAGE_SIZE_STEP) * IMAGE_SIZE_STEP;
        shortSide = Math.round(longSide / longRatio / IMAGE_SIZE_STEP) * IMAGE_SIZE_STEP;
    } else {
        shortSide = DEFAULT_IMAGE_SHORT_SIDE;
        longSide = Math.round((shortSide * longRatio) / IMAGE_SIZE_STEP) * IMAGE_SIZE_STEP;
    }

    const width = isLandscape ? longSide : shortSide;
    const height = isLandscape ? shortSide : longSide;
    validateImageSize(width, height);
    return `${width}x${height}`;
}

function parseImageRatio(value: string) {
    const parts = value.split(":");
    if (parts.length !== 2) throw new Error("图像尺寸格式不支持，请使用 auto、9:16 或 1024x1024");
    const w = Number(parts[0]);
    const h = Number(parts[1]);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) throw new Error("图像比例必须是正数，例如 9:16");
    if (Math.max(w, h) / Math.min(w, h) > IMAGE_MAX_RATIO) throw new Error("图像宽高比不能超过 3:1，请调整尺寸");
    return { width: w, height: h };
}

function parseImageDimensions(value: string) {
    const match = value.match(/^(\d+)x(\d+)$/i);
    if (!match) return null;
    return { width: Number(match[1]), height: Number(match[2]) };
}

function validateImageSize(width: number, height: number) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) throw new Error("图像尺寸必须是正整数，例如 1024x1024");
    if (width % IMAGE_SIZE_STEP !== 0 || height % IMAGE_SIZE_STEP !== 0) throw new Error("图像尺寸的宽高必须是 16 的倍数，请调整尺寸");
    if (Math.max(width, height) > IMAGE_MAX_EDGE) throw new Error("图像尺寸最长边不能超过 3840px，请调整尺寸");
    if (Math.max(width, height) / Math.min(width, height) > IMAGE_MAX_RATIO) throw new Error("图像宽高比不能超过 3:1，请调整尺寸");
    const pixels = width * height;
    if (pixels < IMAGE_MIN_PIXELS || pixels > IMAGE_MAX_PIXELS) throw new Error("图像总像素需在 655360 到 8294400 之间，请调整尺寸");
}

function resolveRequestSize(quality: string | undefined, size: string) {
    const value = size.trim();
    if (!value || value.toLowerCase() === "auto") return undefined;
    const dimensions = parseImageDimensions(value);
    if (dimensions) {
        validateImageSize(dimensions.width, dimensions.height);
        return `${dimensions.width}x${dimensions.height}`;
    }
    if (value.includes(":")) return resolveSize(quality, value);
    throw new Error("图像尺寸格式不支持，请使用 auto、9:16 或 1024x1024");
}

function imageModelParamsFromConfig(config: AiConfig, count: number): ImageModelParams {
    const size = (config.size || "").trim();
    const quality = (config.quality || "").trim();
    const grokImagine = /grok-imagine/i.test(config.imageModel || config.model);
    const normalizedQuality = normalizeImageModelParamQuality(grokImagine ? (quality === "low" ? "1k" : "2k") : quality);
    return {
        sampleCount: count,
        ...(size && size !== "auto" && size.includes(":") ? { aspectRatio: size } : {}),
        ...(size && size !== "auto" && !size.includes(":") ? { size } : {}),
        ...(normalizedQuality ? { quality: normalizedQuality } : {}),
    };
}

function normalizeImageModelParamQuality(value: string): ImageModelParams["quality"] | undefined {
    if (value === "standard" || value === "hd" || value === "high" || value === "medium" || value === "low" || value === "1k" || value === "2k") return value;
    return undefined;
}

function resolveGeminiImageConfig(config: AiConfig) {
    const value = config.size.trim();
    const dimensions = parseImageDimensions(value);
    const ratio = dimensions ? `${dimensions.width}:${dimensions.height}` : value;
    const aspectRatio = value && value.toLowerCase() !== "auto" ? closestGeminiAspectRatio(ratio) : undefined;
    const imageSize = supportsGeminiImageSize(config.model) ? resolveGeminiImageSize(config.quality, dimensions) : undefined;
    const image = { ...(aspectRatio ? { aspectRatio } : {}), ...(imageSize ? { imageSize } : {}) };
    return Object.keys(image).length ? { responseFormat: { image } } : {};
}

function closestGeminiAspectRatio(value: string) {
    const ratio = parseImageRatio(value);
    const target = ratio.width / ratio.height;
    return GEMINI_SUPPORTED_RATIOS.reduce((best, item) => {
        const current = parseImageRatio(item);
        const bestRatio = parseImageRatio(best);
        return Math.abs(current.width / current.height - target) < Math.abs(bestRatio.width / bestRatio.height - target) ? item : best;
    });
}

function resolveGeminiImageSize(quality: string, dimensions: { width: number; height: number } | null) {
    const normalizedQuality = normalizeQuality(quality);
    if (normalizedQuality) return GEMINI_IMAGE_SIZE_BY_QUALITY[normalizedQuality];
    if (!dimensions) return undefined;
    const edge = Math.max(dimensions.width, dimensions.height);
    if (edge <= 768) return "512";
    if (edge <= 1536) return "1K";
    if (edge <= 3072) return "2K";
    return "4K";
}

function supportsGeminiImageSize(model: string) {
    const value = model.toLowerCase();
    return value.includes("gemini-3") || value.includes("3.1") || value.includes("3-pro");
}

function resolveImageDataUrl(item: Record<string, unknown>) {
    if (typeof item.b64_json === "string" && item.b64_json) {
        return `data:image/png;base64,${item.b64_json}`;
    }
    if (typeof item.url === "string" && item.url) {
        return item.url;
    }
    return null;
}

function parseImagePayload(payload: ImageApiResponse) {
    if (typeof payload.code === "number" && payload.code !== 0) {
        throw new Error(payload.msg || "请求失败");
    }
    const images =
        payload.data
            ?.map(resolveImageDataUrl)
            .filter((value): value is string => Boolean(value))
            .map((dataUrl) => ({ id: nanoid(), dataUrl })) || [];

    if (images.length === 0) {
        throw new Error("接口没有返回图片");
    }

    return images;
}

function readAxiosError(error: unknown, fallback: string) {
    if (axios.isCancel(error)) return "请求已取消";
    if (axios.isAxiosError<{ error?: { message?: string }; msg?: string; code?: number }>(error)) {
        const responseData = error.response?.data;
        return responseData?.msg || responseData?.error?.message || readStatusError(error.response?.status, fallback);
    }
    if (error instanceof DOMException && error.name === "AbortError") return "请求已取消";
    return error instanceof Error ? error.message : fallback;
}

function readStatusError(status: number | undefined, fallback: string) {
    if (status === 401 || status === 403) return "鉴权失败，请检查 API Key、套餐权限或模型权限";
    if (status === 429) return "请求被限流或额度不足，请稍后重试";
    return status ? `${fallback}：${status}` : fallback;
}

function withSystemPrompt(config: AiConfig, prompt: string) {
    const systemPrompt = config.systemPrompt.trim();
    return systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
}

function aiApiUrl(config: AiConfig, path: string) {
    return buildApiUrl(config.baseUrl, path);
}

function aiHeaders(config: AiConfig, contentType?: string): Record<string, string> {
    return {
        Authorization: `Bearer ${config.apiKey}`,
        ...modelCapabilityHeaders(config),
        ...(contentType ? { "Content-Type": contentType } : {}),
    };
}

function geminiBaseUrl(config: Pick<AiConfig, "baseUrl">) {
    const normalizedBaseUrl = config.baseUrl.trim().replace(/\/+$/, "");
    const lowerBaseUrl = normalizedBaseUrl.toLowerCase();
    return lowerBaseUrl.endsWith("/v1") || lowerBaseUrl.endsWith("/v1beta") ? normalizedBaseUrl : `${normalizedBaseUrl}/v1beta`;
}

function geminiModelName(model: string) {
    return model.trim().replace(/^models\//, "");
}

function geminiApiUrl(config: Pick<AiConfig, "baseUrl" | "model">, action?: "generateContent" | "streamGenerateContent") {
    const baseUrl = geminiBaseUrl(config);
    if (!action) return `${baseUrl}/models`;
    return `${baseUrl}/models/${encodeURIComponent(geminiModelName(config.model))}:${action}`;
}

function geminiHeaders(config: Pick<AiConfig, "apiKey">) {
    return {
        "x-goog-api-key": config.apiKey,
        "Content-Type": "application/json",
    };
}

function withSystemMessage<T extends ResponseInputMessage>(config: AiConfig, messages: T[]): ResponseInputMessage[] {
    const systemPrompt = config.systemPrompt.trim();
    return systemPrompt ? [{ role: "system" as const, content: systemPrompt }, ...messages] : messages;
}

function toResponseInput(messages: ResponseInputMessage[]): ResponseInputItem[] {
    return messages.flatMap((message): ResponseInputItem[] => {
        if ("type" in message) return [message];
        if (message.role === "tool") return [{ type: "function_call_output", call_id: message.tool_call_id, output: message.content }];
        return [{ role: message.role, content: toResponseContent(message.content || "") }];
    });
}

function toResponseContent(content: ResponseMessageContent): string | ResponseInputContent[] {
    if (!Array.isArray(content)) return String(content || "");
    return content.map((item) => {
        if (item.type === "text") return { type: "input_text" as const, text: item.text };
        if (item.type === "image_url") return { type: "input_image" as const, image_url: item.image_url.url };
        throw new Error("视频理解需要使用 OpenAI Chat Completions 调用格式");
    });
}

export function toOpenAiChatMessages(messages: ResponseInputMessage[]): OpenAiChatMessage[] {
    const result: OpenAiChatMessage[] = [];
    messages.forEach((message) => {
        if ("type" in message) {
            const toolCall: OpenAiChatToolCall = {
                id: message.call_id,
                type: "function",
                function: { name: message.name, arguments: message.arguments },
            };
            const previous = result.at(-1);
            if (previous && previous.role === "assistant" && "tool_calls" in previous) previous.tool_calls.push(toolCall);
            else result.push({ role: "assistant", content: null, tool_calls: [toolCall] });
            return;
        }
        if (message.role === "tool") {
            result.push({ role: "tool", tool_call_id: message.tool_call_id, content: message.content });
            return;
        }
        result.push({ role: message.role, content: message.content || "" });
    });
    return result;
}

function messagesContainVideo(messages: ResponseInputMessage[]) {
    return messages.some((message) => !("type" in message) && message.role !== "tool" && Array.isArray(message.content) && message.content.some((item) => item.type === "video_url"));
}

function shouldUseOpenAiChat(config: AiConfig, messages: ResponseInputMessage[]) {
    return messagesContainVideo(messages) || inferModelInfo(config.model).apiFormat !== "openai-response";
}

function toOpenAiChatToolChoice(toolChoice: ToolChoice) {
    if (typeof toolChoice === "string") return toolChoice;
    return { type: "function" as const, function: { name: toolChoice.name } };
}

function toResponseTool(tool: ResponseFunctionTool): ResponseApiToolDefinition {
    return {
        type: "function",
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
        strict: tool.function.strict,
    };
}

function parseToolResponse(payload: ResponseApiPayload): ToolResponseResult {
    const output = payload.output || [];
    const content =
        payload.output_text ||
        output
            .flatMap((item) => (item.type === "message" ? item.content || [] : []))
            .map((item) => item.text || "")
            .join("");
    const toolCalls = output
        .filter((item): item is Extract<ResponseApiOutputItem, { type?: "function_call" }> => item.type === "function_call")
        .map((item) => ({
            id: item.call_id || item.id || "",
            type: "function" as const,
            function: { name: item.name || "", arguments: item.arguments || "{}" },
        }))
        .filter((item) => item.id && item.function.name);
    return { content, toolCalls };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function responseErrorMessage(value: unknown) {
    if (!isRecord(value)) return "";
    const error = isRecord(value.error) ? value.error : undefined;
    const response = isRecord(value.response) ? value.response : undefined;
    const responseError = response && isRecord(response.error) ? response.error : undefined;
    return stringValue(value.msg) || stringValue(error?.message) || stringValue(responseError?.message);
}

function stringValue(value: unknown) {
    return typeof value === "string" ? value : "";
}

function validateResponsePayload(payload: ResponseApiPayload) {
    if (typeof payload.code === "number" && payload.code !== 0) throw new Error(payload.msg || "请求失败");
    if (payload.error?.message) throw new Error(payload.error.message);
}

function validateGeminiPayload(payload: GeminiPayload) {
    if (payload.error?.message) throw new Error(payload.error.message);
    if (payload.promptFeedback?.blockReason) throw new Error(`Gemini 拒绝了本次请求：${payload.promptFeedback.blockReason}`);
}

async function readFetchError(response: Response, fallback: string) {
    const text = await response.text();
    if (!text) return readStatusError(response.status, fallback);
    try {
        return responseErrorMessage(JSON.parse(text)) || readStatusError(response.status, fallback);
    } catch {
        return text.slice(0, 300) || readStatusError(response.status, fallback);
    }
}

function consumeResponseStreamBlock(block: string, state: ResponseStreamState, onDelta?: (text: string) => void) {
    const data = block
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).replace(/^ /, ""))
        .join("\n")
        .trim();
    if (!data || data === "[DONE]") return;
    const event = JSON.parse(data) as Record<string, unknown>;
    const type = stringValue(event.type);
    const errorMessage = responseErrorMessage(event);
    if (errorMessage) state.error = errorMessage;
    if (type === "response.output_text.delta" && typeof event.delta === "string") {
        state.text += event.delta;
        onDelta?.(state.text);
    }
    if (type === "response.output_text.done" && !state.text && typeof event.text === "string") {
        state.text = event.text;
        onDelta?.(state.text);
    }
    if (type === "response.completed" && isRecord(event.response)) {
        state.payload = event.response as ResponseApiPayload;
    } else if (Array.isArray(event.output)) {
        state.payload = event as ResponseApiPayload;
    }
}

function consumeResponseStreamText(state: ResponseStreamState, text: string, onDelta?: (text: string) => void, flush = false) {
    state.buffer += text;
    for (;;) {
        const match = state.buffer.match(/\r?\n\r?\n/);
        if (!match) break;
        const index = match.index ?? 0;
        consumeResponseStreamBlock(state.buffer.slice(0, index), state, onDelta);
        state.buffer = state.buffer.slice(index + match[0].length);
    }
    if (flush && state.buffer.trim()) {
        consumeResponseStreamBlock(state.buffer, state, onDelta);
        state.buffer = "";
    }
}

async function requestStreamingResponse(config: AiConfig, body: Record<string, unknown>, onDelta?: (text: string) => void, options?: RequestOptions): Promise<ToolResponseResult> {
    const response = await fetch(aiApiUrl(config, "/responses"), {
        method: "POST",
        headers: { ...aiHeaders(config, "application/json"), Accept: "text/event-stream" },
        body: JSON.stringify({ ...body, stream: true }),
        signal: options?.signal,
    });
    if (!response.ok) throw new Error(await readFetchError(response, "请求失败"));
    if (!response.body) {
        const payload = (await response.json()) as ResponseApiPayload;
        validateResponsePayload(payload);
        return parseToolResponse(payload);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const state: ResponseStreamState = { buffer: "", text: "" };
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        consumeResponseStreamText(state, decoder.decode(value, { stream: true }), onDelta);
        if (state.error) throw new Error(state.error);
    }
    consumeResponseStreamText(state, decoder.decode(), onDelta, true);
    if (state.error) throw new Error(state.error);
    if (!state.payload) return { content: state.text, toolCalls: [] };
    validateResponsePayload(state.payload);
    const result = parseToolResponse(state.payload);
    return { ...result, content: state.text || result.content };
}

function parseOpenAiChatPayload(payload: OpenAiChatPayload): ToolResponseResult {
    if (typeof payload.code === "number" && payload.code !== 0) throw new Error(payload.msg || "请求失败");
    if (payload.error?.message) throw new Error(payload.error.message);
    const message = payload.choices?.[0]?.message;
    return {
        content: typeof message?.content === "string" ? message.content : "",
        toolCalls: (message?.tool_calls || []).map((item) => ({ ...item, type: "function" as const })),
    };
}

function consumeOpenAiChatStreamBlock(block: string, state: OpenAiChatStreamState, onDelta?: (text: string) => void) {
    const data = block
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("");
    if (!data || data === "[DONE]") return;
    let payload: OpenAiChatPayload;
    try {
        payload = JSON.parse(data) as OpenAiChatPayload;
    } catch {
        return;
    }
    if (payload.error?.message || (typeof payload.code === "number" && payload.code !== 0)) {
        state.error = payload.error?.message || payload.msg || "请求失败";
        return;
    }
    const choice = payload.choices?.[0];
    const message = choice?.message;
    if (message) {
        if (!state.text && typeof message.content === "string") state.text = message.content;
        (message.tool_calls || []).forEach((item, index) => state.toolCalls.set(index, item));
    }
    const delta = choice?.delta;
    if (typeof delta?.content === "string") {
        state.text += delta.content;
        onDelta?.(state.text);
    }
    (delta?.tool_calls || []).forEach((item) => {
        const index = item.index || 0;
        const current = state.toolCalls.get(index) || { id: "", type: "function" as const, function: { name: "", arguments: "" } };
        if (item.id) current.id = item.id;
        if (item.function?.name) current.function.name += item.function.name;
        if (item.function?.arguments) current.function.arguments += item.function.arguments;
        state.toolCalls.set(index, current);
    });
}

function consumeOpenAiChatStreamText(state: OpenAiChatStreamState, text: string, onDelta?: (text: string) => void, flush = false) {
    state.buffer += text;
    for (;;) {
        const match = state.buffer.match(/\r?\n\r?\n/);
        if (!match) break;
        const index = match.index ?? 0;
        consumeOpenAiChatStreamBlock(state.buffer.slice(0, index), state, onDelta);
        state.buffer = state.buffer.slice(index + match[0].length);
    }
    if (flush && state.buffer.trim()) {
        consumeOpenAiChatStreamBlock(state.buffer, state, onDelta);
        state.buffer = "";
    }
}

async function requestStreamingOpenAiChat(config: AiConfig, body: Record<string, unknown>, onDelta?: (text: string) => void, options?: RequestOptions): Promise<ToolResponseResult> {
    const response = await fetch(aiApiUrl(config, "/chat/completions"), {
        method: "POST",
        headers: { ...aiHeaders(config, "application/json"), Accept: "text/event-stream" },
        body: JSON.stringify({ ...body, stream: true }),
        signal: options?.signal,
    });
    if (!response.ok) throw new Error(await readFetchError(response, "请求失败"));
    if (!response.body || response.headers.get("content-type")?.includes("application/json")) {
        return parseOpenAiChatPayload((await response.json()) as OpenAiChatPayload);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const state: OpenAiChatStreamState = { buffer: "", text: "", toolCalls: new Map() };
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        consumeOpenAiChatStreamText(state, decoder.decode(value, { stream: true }), onDelta);
        if (state.error) throw new Error(state.error);
    }
    consumeOpenAiChatStreamText(state, decoder.decode(), onDelta, true);
    if (state.error) throw new Error(state.error);
    return {
        content: state.text,
        toolCalls: Array.from(state.toolCalls.entries())
            .sort(([left], [right]) => left - right)
            .map(([, item]) => item)
            .filter((item) => item.id && item.function.name),
    };
}

function toGeminiBody(config: AiConfig, messages: ResponseInputMessage[], extra?: Record<string, unknown>) {
    const systemText = [
        config.systemPrompt.trim(),
        ...messages.flatMap((message) => (!("type" in message) && message.role === "system" ? [geminiTextContent(message.content)] : [])),
    ]
        .filter(Boolean)
        .join("\n\n");
    const contents = toGeminiContents(messages.filter((message) => ("type" in message ? true : message.role !== "system")));
    return {
        contents,
        ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
        ...extra,
    };
}

function toGeminiContents(messages: ResponseInputMessage[]): GeminiContent[] {
    const callNameById = new Map<string, string>();
    return messages.flatMap((message): GeminiContent[] => {
        if ("type" in message) {
            callNameById.set(message.call_id, message.name);
            return [{ role: "model", parts: [{ functionCall: { id: message.call_id, name: message.name, args: jsonObject(message.arguments) }, ...(message.thoughtSignature ? { thoughtSignature: message.thoughtSignature } : {}) }] }];
        }
        if (message.role === "tool") {
            const name = callNameById.get(message.tool_call_id) || "tool_result";
            return [{ role: "user", parts: [{ functionResponse: { id: message.tool_call_id, name, response: { result: jsonValue(message.content) } } }] }];
        }
        return [{ role: message.role === "assistant" ? "model" : "user", parts: toGeminiParts(message.content) }];
    });
}

function toGeminiParts(content: ResponseMessageContent): GeminiPart[] {
    if (!Array.isArray(content)) return [{ text: String(content || "") }];
    return content.map((item) => {
        if (item.type === "text") return { text: item.text };
        if (item.type === "image_url") return toGeminiMediaPart(item.image_url.url, "image/png");
        return toGeminiMediaPart(item.video_url.url, "video/mp4");
    });
}

function toGeminiMediaPart(url: string, fallbackMimeType: string): GeminiPart {
    const match = url.match(/^data:([^;,]+);base64,(.+)$/);
    if (match) return { inlineData: { mimeType: match[1], data: match[2] } };
    return { fileData: { fileUri: url, mimeType: fallbackMimeType } };
}

function geminiTextContent(content: ResponseMessageContent) {
    if (!Array.isArray(content)) return String(content || "");
    return content.map((item) => (item.type === "text" ? item.text : item.type === "image_url" ? item.image_url.url : item.video_url.url)).join("\n");
}

function jsonObject(value: string): Record<string, unknown> {
    const parsed = jsonValue(value);
    return isRecord(parsed) ? parsed : {};
}

function jsonValue(value: string): unknown {
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

function toGeminiToolOptions(tools: ResponseFunctionTool[], toolChoice: ToolChoice) {
    if (!tools.length) return {};
    const functionDeclarations = tools.map((tool) => ({
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
    }));
    const functionCallingConfig =
        typeof toolChoice === "object"
            ? { mode: "ANY", allowedFunctionNames: [toolChoice.name] }
            : { mode: toolChoice === "required" ? "ANY" : "AUTO" };
    return {
        tools: [{ functionDeclarations }],
        toolConfig: { functionCallingConfig },
    };
}

async function requestGeminiStreamingResponse(config: AiConfig, body: Record<string, unknown>, onDelta?: (text: string) => void, options?: RequestOptions): Promise<ToolResponseResult> {
    const response = await fetch(`${geminiApiUrl(config, "streamGenerateContent")}?alt=sse`, {
        method: "POST",
        headers: geminiHeaders(config),
        body: JSON.stringify(body),
        signal: options?.signal,
    });
    if (!response.ok) throw new Error(await readFetchError(response, "请求失败"));
    if (!response.body) {
        const payload = (await response.json()) as GeminiPayload;
        return parseGeminiToolResponse(payload);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const state: GeminiStreamState = { buffer: "", text: "", toolCalls: [] };
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        consumeGeminiStreamText(state, decoder.decode(value, { stream: true }), onDelta);
        if (state.error) throw new Error(state.error);
    }
    consumeGeminiStreamText(state, decoder.decode(), onDelta, true);
    if (state.error) throw new Error(state.error);
    return { content: state.text, toolCalls: state.toolCalls };
}

function consumeGeminiStreamText(state: GeminiStreamState, text: string, onDelta?: (text: string) => void, flush = false) {
    state.buffer += text;
    for (;;) {
        const match = state.buffer.match(/\r?\n\r?\n/);
        if (!match) break;
        const index = match.index ?? 0;
        consumeGeminiStreamBlock(state.buffer.slice(0, index), state, onDelta);
        state.buffer = state.buffer.slice(index + match[0].length);
    }
    if (flush && state.buffer.trim()) {
        consumeGeminiStreamBlock(state.buffer, state, onDelta);
        state.buffer = "";
    }
}

function consumeGeminiStreamBlock(block: string, state: GeminiStreamState, onDelta?: (text: string) => void) {
    const data = block
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).replace(/^ /, ""))
        .join("\n")
        .trim();
    if (!data || data === "[DONE]") return;
    const result = parseGeminiToolResponse(JSON.parse(data) as GeminiPayload);
    if (result.content) {
        state.text += result.content;
        onDelta?.(state.text);
    }
    state.toolCalls.push(...result.toolCalls);
}

function parseGeminiToolResponse(payload: GeminiPayload): ToolResponseResult {
    validateGeminiPayload(payload);
    const parts = payload.candidates?.flatMap((candidate) => candidate.content?.parts || []) || [];
    const content = parts.map((part) => part.text || "").join("");
    const toolCalls = parts
        .map((part) => part.functionCall)
        .filter((call): call is NonNullable<GeminiPart["functionCall"]> => Boolean(call?.name))
        .map((call) => {
            const part = parts.find((item) => item.functionCall === call);
            const thoughtSignature = part?.thoughtSignature || part?.thought_signature;
            return {
                id: call.id || nanoid(),
                type: "function" as const,
                function: { name: call.name || "", arguments: JSON.stringify(call.args || {}) },
                ...(thoughtSignature ? { thoughtSignature } : {}),
            };
        });
    return { content, toolCalls };
}

async function requestGeminiImages(config: AiConfig, prompt: string, references: ReferenceImage[], count: number, options?: RequestOptions) {
    const requests = Array.from({ length: count }, () => requestGeminiImagesOnce(config, prompt, references, options));
    return (await Promise.all(requests)).flat();
}

async function requestGeminiImagesOnce(config: AiConfig, prompt: string, references: ReferenceImage[], options?: RequestOptions) {
    const parts: GeminiPart[] = [{ text: prompt }];
    for (const image of references) {
        parts.push(toGeminiMediaPart(await imageToDataUrl(image), "image/png"));
    }
    const response = await axios.post<GeminiPayload>(
        geminiApiUrl(config, "generateContent"),
        {
            ...toGeminiBody(config, [{ role: "user", content: prompt }], { generationConfig: { responseModalities: ["TEXT", "IMAGE"], ...resolveGeminiImageConfig(config) } }),
            contents: [{ role: "user", parts }],
        },
        { headers: geminiHeaders(config), signal: options?.signal },
    );
    return parseGeminiImagePayload(response.data);
}

function parseGeminiImagePayload(payload: GeminiPayload) {
    validateGeminiPayload(payload);
    const images =
        payload.candidates
            ?.flatMap((candidate) => candidate.content?.parts || [])
            .map((part) => {
                const inlineData = part.inlineData || (part.inline_data ? { mimeType: part.inline_data.mimeType || part.inline_data.mime_type, data: part.inline_data.data } : undefined);
                if (inlineData?.data) return `data:${inlineData.mimeType || "image/png"};base64,${inlineData.data}`;
                return part.fileData?.fileUri || null;
            })
            .filter((value): value is string => Boolean(value))
            .map((dataUrl) => ({ id: nanoid(), dataUrl })) || [];
    if (!images.length) throw new Error("Gemini 接口没有返回图片");
    return images;
}

export async function requestGeneration(config: AiConfig, prompt: string, options?: RequestOptions) {
    const requestConfig = resolveModelRequestConfigForCapability(config, "image");
    const n = Math.max(1, Math.min(15, Math.floor(Math.abs(Number(config.count)) || 1)));
    if (requestConfig.apiFormat === "gemini") {
        try {
            return await requestGeminiImages(requestConfig, prompt, [], n, options);
        } catch (error) {
            throw new Error(readAxiosError(error, "请求失败"));
        }
    }
    if (inferModelInfo(requestConfig.model).apiFormat === "dalle") {
        try {
            const providerRequest = buildRequest({
                modelId: requestConfig.model,
                prompt: withSystemPrompt(requestConfig, prompt),
                modelParams: imageModelParamsFromConfig(requestConfig, n),
                baseUrl: requestConfig.baseUrl,
                apiKey: requestConfig.apiKey,
            });
            const response = await fetch(providerRequest.url, { ...withModelCapabilityHeader(requestConfig, providerRequest.init), signal: options?.signal });
            const parsed = await providerRequest.parseResponse(response);
            if (parsed.error) throw new Error(parsed.error);
            const resources = parsed.resources || (parsed.resourceUrl ? [parsed.resourceUrl] : []);
            if (!resources.length) throw new Error("接口没有返回图片");
            return resources.map((dataUrl) => ({ id: nanoid(), dataUrl }));
        } catch (error) {
            throw new Error(readAxiosError(error, "请求失败"));
        }
    }
    const quality = normalizeQuality(config.quality);
    const requestSize = resolveRequestSize(quality, config.size);
    try {
        const response = await axios.post<ImageApiResponse>(
            aiApiUrl(requestConfig, "/images/generations"),
            {
                model: requestConfig.model,
                prompt: withSystemPrompt(requestConfig, prompt),
                n,
                ...(quality ? { quality } : {}),
                ...(requestSize ? { size: requestSize } : {}),
                output_format: IMAGE_OUTPUT_FORMAT,
            },
            {
                headers: aiHeaders(requestConfig, "application/json"),
                signal: options?.signal,
            },
        );
        const images = parseImagePayload(response.data);
        return images;
    } catch (error) {
        throw new Error(readAxiosError(error, "请求失败"));
    }
}

export async function requestEdit(config: AiConfig, prompt: string, references: ReferenceImage[], mask?: ReferenceImage, options?: RequestOptions) {
    const requestConfig = resolveModelRequestConfigForCapability(config, "image");
    const n = Math.max(1, Math.min(15, Math.floor(Math.abs(Number(config.count)) || 1)));
    const requestPrompt = buildImageReferencePromptText(prompt, references);
    if (requestConfig.apiFormat === "gemini") {
        if (mask) throw new Error("Gemini 调用格式暂不支持蒙版编辑");
        try {
            return await requestGeminiImages(requestConfig, requestPrompt, references, n, options);
        } catch (error) {
            throw new Error(readAxiosError(error, "请求失败"));
        }
    }
    if (inferModelInfo(requestConfig.model).apiFormat === "dalle") {
        if (/^agnes-image/i.test(requestConfig.model)) {
            try {
                const refDataUrl = await imageToDataUrl(references[0]);
                const response = await axios.post<ImageApiResponse>(
                    aiApiUrl(requestConfig, "/images/generations"),
                    {
                        model: requestConfig.model,
                        prompt: withSystemPrompt(requestConfig, requestPrompt),
                        n,
                        image: refDataUrl,
                    },
                    { headers: aiHeaders(requestConfig, "application/json"), signal: options?.signal },
                );
                return parseImagePayload(response.data);
            } catch (error) {
                throw new Error(readAxiosError(error, "请求失败"));
            }
        }
        try {
            const files = await Promise.all(references.map(async (image) => dataUrlToFile({ ...image, dataUrl: await imageToDataUrl(image) })));
            const maskFile = mask ? dataUrlToFile({ ...mask, dataUrl: await imageToDataUrl(mask) }) : undefined;
            const providerRequest = buildRequest({
                operation: "edit",
                modelId: requestConfig.model,
                prompt: withSystemPrompt(requestConfig, requestPrompt),
                imageFiles: files,
                mask: maskFile,
                modelParams: imageModelParamsFromConfig(requestConfig, n),
                baseUrl: requestConfig.baseUrl,
                apiKey: requestConfig.apiKey,
            });
            const response = await fetch(providerRequest.url, { ...withModelCapabilityHeader(requestConfig, providerRequest.init), signal: options?.signal });
            const parsed = await providerRequest.parseResponse(response);
            if (parsed.error) throw new Error(parsed.error);
            const resources = parsed.resources || (parsed.resourceUrl ? [parsed.resourceUrl] : []);
            if (!resources.length) throw new Error("接口没有返回图片");
            return resources.map((dataUrl) => ({ id: nanoid(), dataUrl }));
        } catch (error) {
            throw new Error(readAxiosError(error, "请求失败"));
        }
    }
    const quality = normalizeQuality(config.quality);
    const requestSize = resolveRequestSize(quality, config.size);
    const formData = new FormData();
    formData.set("model", requestConfig.model);
    formData.set("prompt", withSystemPrompt(requestConfig, requestPrompt));
    formData.set("n", String(n));
    formData.set("output_format", IMAGE_OUTPUT_FORMAT);
    if (quality) {
        formData.set("quality", quality);
    }
    if (requestSize) {
        formData.set("size", requestSize);
    }
    const files = await Promise.all(references.map(async (image) => dataUrlToFile({ ...image, dataUrl: await imageToDataUrl(image) })));
    // 多图走 OpenAI 数组字段 image[]，单图保持 image（避免 newapi 网关多图按非数组解析返回 422）。
    const imageField = files.length > 1 ? "image[]" : "image";
    files.forEach((file) => formData.append(imageField, file));
    if (mask) formData.set("mask", dataUrlToFile(mask));

    try {
        const response = await axios.post<ImageApiResponse>(aiApiUrl(requestConfig, "/images/edits"), formData, { headers: aiHeaders(requestConfig), signal: options?.signal });
        const images = parseImagePayload(response.data);
        return images;
    } catch (error) {
        throw new Error(readAxiosError(error, "请求失败"));
    }
}

export async function requestImageQuestion(config: AiConfig, messages: AiTextMessage[], onDelta: (text: string) => void, options?: RequestOptions) {
    const requestConfig = resolveModelRequestConfigForCapability(config, "text");
    try {
        if (requestConfig.apiFormat === "gemini") {
            const answer = (await requestGeminiStreamingResponse(requestConfig, toGeminiBody(requestConfig, messages), onDelta, options)).content || "没有返回内容";
            if (answer === "没有返回内容") onDelta(answer);
            return answer;
        }
        const requestMessages = withSystemMessage(requestConfig, messages);
        const videoOutputOptions = messagesContainVideo(requestMessages) ? { max_tokens: 4096 } : {};
        const result = shouldUseOpenAiChat(requestConfig, requestMessages)
            ? await requestStreamingOpenAiChat(requestConfig, { model: requestConfig.model, messages: toOpenAiChatMessages(requestMessages), ...videoOutputOptions }, onDelta, options)
            : await requestStreamingResponse(requestConfig, { model: requestConfig.model, input: toResponseInput(requestMessages) }, onDelta, options);
        const answer = result.content || "没有返回内容";
        if (answer === "没有返回内容") onDelta(answer);
        return answer;
    } catch (error) {
        throw new Error(readAxiosError(error, "请求失败"));
    }
}

export async function requestToolResponse(config: AiConfig, messages: ResponseInputMessage[], tools: ResponseFunctionTool[], toolChoice: ToolChoice = "auto", onDelta?: (text: string) => void, options?: RequestOptions): Promise<ToolResponseResult> {
    const requestConfig = resolveModelRequestConfigForCapability(config, "text");
    try {
        if (requestConfig.apiFormat === "gemini") {
            return await requestGeminiStreamingResponse(requestConfig, toGeminiBody(requestConfig, messages, toGeminiToolOptions(tools, toolChoice)), onDelta, options);
        }
        const requestMessages = withSystemMessage(requestConfig, messages);
        if (shouldUseOpenAiChat(requestConfig, requestMessages)) {
            return await requestStreamingOpenAiChat(
                requestConfig,
                {
                    model: requestConfig.model,
                    messages: toOpenAiChatMessages(requestMessages),
                    tools,
                    tool_choice: toOpenAiChatToolChoice(toolChoice),
                    parallel_tool_calls: false,
                },
                onDelta,
                options,
            );
        }
        return await requestStreamingResponse(
            requestConfig,
            {
                model: requestConfig.model,
                input: toResponseInput(requestMessages),
                tools: tools.map(toResponseTool),
                tool_choice: toolChoice,
                parallel_tool_calls: false,
            },
            onDelta,
            options,
        );
    } catch (error) {
        throw new Error(readAxiosError(error, "请求失败"));
    }
}

export async function fetchImageModels(config: Pick<AiConfig, "baseUrl" | "apiKey" | "apiFormat">) {
    try {
        if (config.apiFormat === "gemini") {
            const response = await axios.get<GeminiPayload>(geminiApiUrl({ ...defaultGeminiConfig, ...config }), { headers: geminiHeaders({ ...defaultGeminiConfig, ...config }) });
            validateGeminiPayload(response.data);
            return (response.data.models || [])
                .map((model) => model.name?.replace(/^models\//, ""))
                .filter((id): id is string => Boolean(id))
                .sort((a, b) => a.localeCompare(b));
        }
        const response = await axios.get<{ data?: Array<{ id?: string }>; error?: { message?: string } }>(buildApiUrl(config.baseUrl, "/models"), {
            headers: {
                Authorization: `Bearer ${config.apiKey}`,
            },
        });
        return (response.data.data || [])
            .map((model) => model.id)
            .filter((id): id is string => Boolean(id))
            .sort((a, b) => a.localeCompare(b));
    } catch (error) {
        throw new Error(readAxiosError(error, "读取模型失败"));
    }
}

const defaultGeminiConfig: Pick<AiConfig, "baseUrl" | "apiKey" | "apiFormat" | "model" | "systemPrompt"> = {
    baseUrl: "https://generativelanguage.googleapis.com",
    apiKey: "",
    apiFormat: "gemini",
    model: "",
    systemPrompt: "",
};
