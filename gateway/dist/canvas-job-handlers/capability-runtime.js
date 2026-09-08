import { createHash, randomUUID } from "node:crypto";
import { canvasArtifactStoragePath, isOwnedCanvasArtifactPath } from "../canvas-artifact-routes.js";
import { buildUpstreamUrl } from "../catalog.js";
import { decryptSecret } from "../encryption.js";
export function createLocalCapabilityRuntimes(store) {
    const publicBaseUrl = (process.env.GATEWAY_PUBLIC_URL || `http://127.0.0.1:${Number(process.env.PORT) || 8788}`).replace(/\/+$/, "");
    return createCapabilityRuntimes({
        loadModel: async (id) => store.listModels().find((model) => model.id === id) || null,
        loadChannel: async (id) => store.getChannel(id) || null,
        resolveArtifact: async (job, uri) => {
            const artifact = store.readCanvasArtifact(job.user_id, job.canvas_id, uri);
            if (!artifact)
                throw new Error("画布参考素材不存在或无权访问");
            return `data:${artifact.mime_type};base64,${artifact.bytes.toString("base64")}`;
        },
        saveOutput: async (job, bytes, mimeType, name) => {
            const checksum = createHash("sha256").update(bytes).digest("hex");
            const artifact = store.saveCanvasArtifact(job.user_id, job.canvas_id, { name, mimeType, bytes, checksum });
            const query = new URLSearchParams({ canvasId: job.canvas_id, uri: artifact.uri });
            return { url: `${publicBaseUrl}/v1/canvas-artifacts/content?${query}`, storageKey: artifact.uri };
        },
        isGenerationCurrent: async (job) => !store.listCanvasJobs(job.user_id, { canvasId: job.canvas_id }).some((candidate) => candidate.target_node_id === job.target_node_id && candidate.generation_revision > job.generation_revision),
    });
}
export function createSupabaseCapabilityRuntimes(admin) {
    return createCapabilityRuntimes({
        loadModel: async (id) => {
            const { data, error } = await admin.from("gouyingai_models").select("*").eq("id", id).maybeSingle();
            if (error)
                throw new Error(error.message);
            return data || null;
        },
        loadChannel: async (id) => {
            const { data, error } = await admin.from("gouyingai_channels").select("*").eq("id", id).maybeSingle();
            if (error)
                throw new Error(error.message);
            return data || null;
        },
        resolveArtifact: async (job, uri) => {
            const path = canvasArtifactStoragePath(uri);
            if (!isOwnedCanvasArtifactPath(job.user_id, job.canvas_id, path))
                throw new Error("画布参考素材不存在或无权访问");
            const { data, error } = await admin.storage.from("gouyingai-media").download(path);
            if (error || !data)
                throw new Error(error?.message || "画布参考素材下载失败");
            return `data:${data.type || "application/octet-stream"};base64,${Buffer.from(await data.arrayBuffer()).toString("base64")}`;
        },
        saveOutput: async (job, bytes, mimeType, name) => {
            const path = `${encodeURIComponent(job.user_id)}/canvas/${encodeURIComponent(job.canvas_id)}/outputs/${job.id}/${randomUUID()}-${safeFileName(name)}`;
            const bucket = admin.storage.from("gouyingai-media");
            const uploaded = await bucket.upload(path, bytes, { contentType: mimeType, upsert: false });
            if (uploaded.error)
                throw new Error(uploaded.error.message);
            const signed = await bucket.createSignedUrl(path, 7 * 24 * 60 * 60);
            if (signed.error || !signed.data?.signedUrl)
                throw new Error(signed.error?.message || "生成结果签名失败");
            return { url: signed.data.signedUrl, storageKey: `canvas-artifact:${path}` };
        },
        isGenerationCurrent: (job) => isSupabaseGenerationCurrent(admin, job),
    });
}
function createCapabilityRuntimes(dependencies) {
    const shared = {
        loadModel: dependencies.loadModel,
        loadChannel: dependencies.loadChannel,
        isGenerationCurrent: dependencies.isGenerationCurrent,
    };
    return {
        text: { ...shared, generate: ({ job, model, channel, signal }) => generateText(job, model, channel, signal, dependencies.resolveArtifact) },
        image: { ...shared, generate: ({ job, model, channel, signal }) => generateImage(job, model, channel, signal, dependencies.resolveArtifact, dependencies.saveOutput) },
        audio: { ...shared, generate: ({ job, model, channel, signal }) => generateAudio(job, model, channel, signal, dependencies.saveOutput) },
    };
}
async function generateText(job, model, channel, signal, resolveArtifact) {
    const prompt = stringValue(job.input.prompt);
    const references = await resolveArtifactList(job, job.input.references, resolveArtifact);
    if (channel.api_format === "gemini") {
        const parts = [{ text: prompt }];
        for (const reference of references) {
            const data = parseDataUrl(reference);
            if (data)
                parts.push({ inlineData: { mimeType: data.mimeType, data: data.bytes.toString("base64") } });
        }
        const response = await fetch(geminiUrl(channel.base_url, model.model_name), {
            method: "POST",
            headers: { "x-goog-api-key": decryptSecret(channel.key_ciphertext), "content-type": "application/json" },
            body: JSON.stringify({ contents: [{ role: "user", parts }] }),
            signal,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok)
            throw new Error(readError(payload) || `文本生成失败（${response.status}）`);
        const partsResult = objectList(objectValue(objectValue(objectList(objectValue(payload).candidates)[0]).content).parts);
        const combined = partsResult.map((part) => stringValue(part.text)).join("").trim();
        if (!combined)
            throw new Error("文本接口没有返回内容");
        return { text: combined };
    }
    const input = Array.isArray(job.input.messages) ? job.input.messages : prompt;
    const response = await fetch(buildUpstreamUrl(channel.base_url, stringValue(model.options?.textEndpoint) || "/responses"), {
        method: "POST",
        headers: upstreamJsonHeaders(channel),
        body: JSON.stringify({ model: model.model_name, input }),
        signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok)
        throw new Error(readError(payload) || `文本生成失败（${response.status}）`);
    const text = readTextResult(payload);
    if (!text)
        throw new Error("文本接口没有返回内容");
    return { text };
}
async function generateImage(job, model, channel, signal, resolveArtifact, saveOutput) {
    const prompt = stringValue(job.input.prompt);
    const references = await resolveArtifactList(job, job.input.referenceImages, resolveArtifact);
    let bytes;
    let mimeType = "image/png";
    if (channel.api_format === "gemini") {
        const parts = [{ text: prompt }];
        for (const reference of references) {
            const data = parseDataUrl(reference);
            if (data)
                parts.push({ inlineData: { mimeType: data.mimeType, data: data.bytes.toString("base64") } });
        }
        const response = await fetch(geminiUrl(channel.base_url, model.model_name), {
            method: "POST",
            headers: { "x-goog-api-key": decryptSecret(channel.key_ciphertext), "content-type": "application/json" },
            body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } }),
            signal,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok)
            throw new Error(readError(payload) || `图片生成失败（${response.status}）`);
        const outputParts = objectList(objectValue(objectValue(objectList(objectValue(payload).candidates)[0]).content).parts);
        const image = outputParts.map((part) => objectValue(part.inlineData || part.inline_data)).find((part) => stringValue(part.data));
        if (!image)
            throw new Error("图片接口没有返回图片");
        mimeType = stringValue(image.mimeType || image.mime_type) || mimeType;
        bytes = Buffer.from(stringValue(image.data), "base64");
    }
    else {
        const response = references.length
            ? await fetch(buildUpstreamUrl(channel.base_url, "/images/edits"), { method: "POST", headers: { authorization: `Bearer ${decryptSecret(channel.key_ciphertext)}` }, body: buildImageEditForm(model.model_name, prompt, job.input, references), signal })
            : await fetch(buildUpstreamUrl(channel.base_url, "/images/generations"), { method: "POST", headers: upstreamJsonHeaders(channel), body: JSON.stringify({ model: model.model_name, prompt, n: 1, size: stringValue(job.input.size) || "auto", quality: stringValue(job.input.quality) || undefined }), signal });
        const payload = await response.json().catch(() => null);
        if (!response.ok)
            throw new Error(readError(payload) || `图片生成失败（${response.status}）`);
        const item = objectList(objectValue(payload).data)[0];
        const encoded = stringValue(item?.b64_json);
        const url = stringValue(item?.url);
        if (encoded)
            bytes = Buffer.from(encoded, "base64");
        else if (url) {
            const media = await fetch(url, { signal });
            if (!media.ok)
                throw new Error(`生成图片下载失败（${media.status}）`);
            mimeType = media.headers.get("content-type") || mimeType;
            bytes = Buffer.from(await media.arrayBuffer());
        }
        else
            throw new Error("图片接口没有返回图片");
    }
    const stored = await saveOutput(job, bytes, mimeType, "generated-image.png");
    return { ...stored, mimeType, bytes: bytes.length };
}
async function generateAudio(job, model, channel, signal, saveOutput) {
    if (channel.api_format === "gemini")
        throw new Error("Gemini 渠道不支持音频生成");
    const format = stringValue(job.input.format) || "mp3";
    const response = await fetch(buildUpstreamUrl(channel.base_url, "/audio/speech"), {
        method: "POST",
        headers: upstreamJsonHeaders(channel),
        body: JSON.stringify({
            model: model.model_name,
            input: stringValue(job.input.prompt),
            voice: stringValue(job.input.voice) || "alloy",
            response_format: format,
            speed: Number(job.input.speed) || 1,
            ...(stringValue(job.input.instructions) ? { instructions: stringValue(job.input.instructions) } : {}),
        }),
        signal,
    });
    if (!response.ok)
        throw new Error(readError(await response.json().catch(() => null)) || `音频生成失败（${response.status}）`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const mimeType = response.headers.get("content-type") || audioMimeType(format);
    const stored = await saveOutput(job, bytes, mimeType, `generated-audio.${format}`);
    return { ...stored, mimeType, bytes: bytes.length };
}
async function resolveArtifactList(job, value, resolver) {
    const values = Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
    return Promise.all(values.map((item) => {
        if (!item.startsWith("canvas-artifact:"))
            throw new Error("后台任务只接受已上传到当前画布的私有参考素材");
        return resolver(job, item);
    }));
}
function buildImageEditForm(modelName, prompt, input, references) {
    const form = new FormData();
    form.append("model", modelName);
    form.append("prompt", prompt);
    if (stringValue(input.size))
        form.append("size", stringValue(input.size));
    if (stringValue(input.quality))
        form.append("quality", stringValue(input.quality));
    const imageField = references.length > 1 ? "image[]" : "image";
    references.forEach((reference, index) => {
        const data = parseDataUrl(reference);
        if (data)
            form.append(imageField, new File([data.bytes], `reference-${index}.png`, { type: data.mimeType }));
        else
            form.append(imageField, reference);
    });
    return form;
}
function readTextResult(payload) {
    const value = objectValue(payload);
    const outputText = stringValue(value.output_text);
    if (outputText)
        return outputText;
    const responseOutput = objectList(value.output).flatMap((item) => objectList(item.content)).map((item) => stringValue(item.text)).join("");
    if (responseOutput)
        return responseOutput;
    return stringValue(objectValue(objectList(value.choices)[0]).message && objectValue(objectValue(objectList(value.choices)[0]).message).content);
}
function parseDataUrl(value) {
    const match = value.match(/^data:([^;,]+)?;base64,([A-Za-z0-9+/=]+)$/);
    return match ? { mimeType: match[1] || "application/octet-stream", bytes: Buffer.from(match[2], "base64") } : null;
}
function upstreamJsonHeaders(channel) {
    return { authorization: `Bearer ${decryptSecret(channel.key_ciphertext)}`, "content-type": "application/json" };
}
function geminiUrl(baseUrl, modelName) {
    const normalized = baseUrl.trim().replace(/\/+$/, "");
    const root = /\/v1(?:beta)?$/i.test(normalized) ? normalized : `${normalized}/v1beta`;
    return `${root}/models/${encodeURIComponent(modelName.replace(/^models\//, ""))}:generateContent`;
}
async function isSupabaseGenerationCurrent(admin, job) {
    const { data, error } = await admin
        .from("gouyingai_canvas_jobs")
        .select("id")
        .eq("user_id", job.user_id)
        .eq("canvas_id", job.canvas_id)
        .eq("target_node_id", job.target_node_id)
        .gt("generation_revision", job.generation_revision)
        .limit(1);
    if (error)
        throw new Error(error.message);
    return !data?.length;
}
function readError(payload) {
    const value = objectValue(payload);
    const error = value.error;
    return stringValue(value.message || value.msg || (typeof error === "string" ? error : objectValue(error).message));
}
function objectValue(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function objectList(value) {
    return Array.isArray(value) ? value.map(objectValue) : [];
}
function stringValue(value) {
    return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}
function safeFileName(value) {
    return value.replace(/[^A-Za-z0-9._-]+/g, "-").slice(-100) || "output.bin";
}
function audioMimeType(format) {
    return format === "wav" ? "audio/wav" : format === "opus" ? "audio/opus" : format === "aac" ? "audio/aac" : format === "flac" ? "audio/flac" : "audio/mpeg";
}
//# sourceMappingURL=capability-runtime.js.map