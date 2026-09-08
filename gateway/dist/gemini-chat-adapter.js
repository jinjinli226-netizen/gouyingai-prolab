export async function forwardGeminiChatCompletion(raw, channel, modelName, apiKey) {
    const request = JSON.parse(raw.toString("utf8"));
    const messages = Array.isArray(request.messages) ? request.messages : [];
    const systemParts = [];
    const contents = [];
    for (const message of messages) {
        const role = String(message.role || "user");
        const parts = toGeminiParts(message.content);
        if (role === "system") {
            systemParts.push(...parts.flatMap((part) => typeof part.text === "string" ? [{ text: part.text }] : []));
        }
        else if (parts.length) {
            contents.push({ role: role === "assistant" ? "model" : "user", parts });
        }
    }
    if (!contents.length)
        throw new Error("Gemini 请求缺少可用消息内容");
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
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        return { status: response.status, payload: { error: { message: readGeminiError(payload) || `Gemini 请求失败（${response.status}）` } } };
    }
    const text = (payload?.candidates?.[0]?.content?.parts || []).map((part) => typeof part.text === "string" ? part.text : "").join("");
    if (!text)
        return { status: 502, payload: { error: { message: "Gemini 接口没有返回文本" } } };
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
function toGeminiParts(content) {
    if (typeof content === "string")
        return content ? [{ text: content }] : [];
    if (!Array.isArray(content))
        return [];
    const parts = [];
    for (const item of content) {
        if (item?.type === "text") {
            if (typeof item.text === "string" && item.text)
                parts.push({ text: item.text });
            continue;
        }
        const url = item?.type === "image_url" ? item.image_url?.url : item?.type === "video_url" ? item.video_url?.url : undefined;
        if (typeof url !== "string" || !url)
            continue;
        const data = parseDataUrl(url);
        if (data)
            parts.push({ inlineData: data });
        else
            parts.push({ fileData: { fileUri: url, mimeType: item.type === "video_url" ? "video/mp4" : "image/png" } });
    }
    return parts;
}
function parseDataUrl(value) {
    const match = value.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
    return match ? { mimeType: match[1], data: match[2] } : null;
}
function geminiGenerateContentUrl(baseUrl, modelName) {
    const normalized = baseUrl.trim().replace(/\/+$/, "");
    const root = /\/v1(?:beta)?$/i.test(normalized) ? normalized : `${normalized}/v1beta`;
    return `${root}/models/${encodeURIComponent(modelName.replace(/^models\//, ""))}:generateContent`;
}
function readGeminiError(payload) {
    const error = payload?.error;
    return typeof error === "string" ? error : typeof error?.message === "string" ? error.message : typeof payload?.message === "string" ? payload.message : "";
}
function positiveNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
function finiteNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
//# sourceMappingURL=gemini-chat-adapter.js.map