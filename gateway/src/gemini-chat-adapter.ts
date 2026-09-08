import type { Channel } from "./types.js";

type OpenAiContentPart =
    | { type: "text"; text?: unknown }
    | { type: "image_url"; image_url?: { url?: unknown } }
    | { type: "video_url"; video_url?: { url?: unknown } };

type OpenAiMessage = { role?: unknown; content?: unknown };

export async function forwardGeminiChatCompletion(raw: Buffer, channel: Channel, modelName: string, apiKey: string) {
    const request = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
    const messages = Array.isArray(request.messages) ? request.messages as OpenAiMessage[] : [];
    const systemParts: Array<{ text: string }> = [];
    const contents: Array<{ role: "user" | "model"; parts: Array<Record<string, unknown>> }> = [];
    for (const message of messages) {
        const role = String(message.role || "user");
        const parts = toGeminiParts(message.content);
        if (role === "system") {
            systemParts.push(...parts.flatMap((part) => typeof part.text === "string" ? [{ text: part.text }] : []));
        } else if (parts.length) {
            contents.push({ role: role === "assistant" ? "model" : "user", parts });
        }
    }
    if (!contents.length) throw new Error("Gemini 请求缺少可用消息内容");

    const maxOutputTokens = positiveNumber(request.max_tokens || request.max_completion_tokens);
    const temperature = finiteNumber(request.temperature);
    const generationConfig = {
        ...(maxOutputTokens ? { maxOutputTokens } : {}),
        ...(temperature !== undefined ? { temperature } : {}),
    };
    const body = {
        contents,
        ...(systemParts.length ? { systemInstruction: { parts: systemParts } } : {}),
        ...(Object.keys(generationConfig).length ? { generationConfig } : {}),
    };
    const response = await fetch(geminiGenerateContentUrl(channel.base_url, modelName), {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null) as Record<string, any> | null;
    if (!response.ok) {
        return { status: response.status, payload: { error: { message: readGeminiError(payload) || `Gemini 请求失败（${response.status}）` } } };
    }
    const text = (payload?.candidates?.[0]?.content?.parts || []).map((part: Record<string, unknown>) => typeof part.text === "string" ? part.text : "").join("");
    if (!text) return { status: 502, payload: { error: { message: "Gemini 接口没有返回文本" } } };
    return {
        status: 200,
        payload: {
            id: `gemini-${Date.now()}`,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: modelName,
            choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
            ...(payload?.usageMetadata ? { usage: payload.usageMetadata } : {}),
        },
    };
}

function toGeminiParts(content: unknown): Array<Record<string, unknown>> {
    if (typeof content === "string") return content ? [{ text: content }] : [];
    if (!Array.isArray(content)) return [];
    const parts: Array<Record<string, unknown>> = [];
    for (const item of content as OpenAiContentPart[]) {
        if (item?.type === "text") {
            if (typeof item.text === "string" && item.text) parts.push({ text: item.text });
            continue;
        }
        const url = item?.type === "image_url" ? item.image_url?.url : item?.type === "video_url" ? item.video_url?.url : undefined;
        if (typeof url !== "string" || !url) continue;
        const data = parseDataUrl(url);
        if (data) parts.push({ inlineData: data });
        else parts.push({ fileData: { fileUri: url, mimeType: item.type === "video_url" ? "video/mp4" : "image/png" } });
    }
    return parts;
}

function parseDataUrl(value: string) {
    const match = value.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
    return match ? { mimeType: match[1], data: match[2] } : null;
}

function geminiGenerateContentUrl(baseUrl: string, modelName: string) {
    const normalized = baseUrl.trim().replace(/\/+$/, "");
    const root = /\/v1(?:beta)?$/i.test(normalized) ? normalized : `${normalized}/v1beta`;
    return `${root}/models/${encodeURIComponent(modelName.replace(/^models\//, ""))}:generateContent`;
}

function readGeminiError(payload: Record<string, any> | null) {
    const error = payload?.error;
    return typeof error === "string" ? error : typeof error?.message === "string" ? error.message : typeof payload?.message === "string" ? payload.message : "";
}

function positiveNumber(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function finiteNumber(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
