type JsonObject = Record<string, unknown>;

export type AutoDlVideoInput = {
    prompt: string;
    duration: string;
    resolution: string;
    size: string;
    referenceImages: string[];
    referenceAudios: string[];
};

export type AutoDlNormalizedTask = {
    upstreamTaskId?: string;
    status: "queued" | "in_progress" | "completed" | "failed";
    resultUrl?: string;
    error?: string;
};

type AutoDlModelOptions = {
    workflowId: string;
    requestTemplate: JsonObject;
    durationMap: JsonObject;
    resolutionMap: JsonObject;
    minReferenceImages: number;
    maxReferenceImages?: number;
    minReferenceAudios: number;
    maxReferenceAudios?: number;
    promptRequired: boolean;
    constants: JsonObject;
};

export function buildAutoDlWorkflowRequest(options: JsonObject, input: AutoDlVideoInput) {
    const config = readAutoDlModelOptions(options);
    const prompt = input.prompt.trim();
    const referenceImages = input.referenceImages || [];
    const referenceAudios = input.referenceAudios || [];
    if (config.promptRequired && !prompt) throw new Error("AutoDL 视频提示词不能为空");
    if (referenceImages.length < config.minReferenceImages) {
        throw new Error(`AutoDL 参考图至少 ${config.minReferenceImages} 张`);
    }
    if (config.maxReferenceImages !== undefined && referenceImages.length > config.maxReferenceImages) {
        throw new Error(`AutoDL 参考图最多 ${config.maxReferenceImages} 张`);
    }
    if (referenceAudios.length < config.minReferenceAudios) {
        throw new Error(`AutoDL 参考音频至少 ${config.minReferenceAudios} 段`);
    }
    if (config.maxReferenceAudios !== undefined && referenceAudios.length > config.maxReferenceAudios) {
        throw new Error(`AutoDL 参考音频最多 ${config.maxReferenceAudios} 段`);
    }
    const duration = mappedValue(config.durationMap, input.duration, "时长");
    const resolution = mappedResolution(config.resolutionMap, input.resolution, input.size);
    const indexedImages = Object.fromEntries(Array.from({ length: 9 }, (_value, index) => [`referenceImage${index}`, referenceImages[index]]));
    const indexedAudios = Object.fromEntries(Array.from({ length: 3 }, (_value, index) => [`referenceAudio${index}`, referenceAudios[index]]));
    const values: JsonObject = { ...config.constants, ...indexedImages, ...indexedAudios, prompt, duration, resolution, referenceImages, referenceAudios };
    const body = resolveTemplate(config.requestTemplate, values);
    if (!isObject(body)) throw new Error("AutoDL requestTemplate 必须生成 JSON 对象");
    return { workflowId: config.workflowId, body };
}

export function normalizeAutoDlTask(payload: unknown): AutoDlNormalizedTask {
    const envelope = isObject(payload) ? payload : {};
    const data = isObject(envelope.data) ? envelope.data : {};
    const upstreamTaskId = stringValue(data.task_id) || stringValue(envelope.task_id) || undefined;
    const status = (stringValue(data.status) || stringValue(envelope.status)).toUpperCase();
    const error = readMessage(data) || readMessage(envelope) || undefined;

    if (status === "SUCCESS" || status === "COMPLETED") {
        const resultUrl = firstResultUrl(data.results ?? envelope.results);
        return resultUrl
            ? { upstreamTaskId, status: "completed", resultUrl }
            : { upstreamTaskId, status: "failed", error: "AutoDL 任务成功但没有返回视频文件" };
    }
    if (["FAILED", "FAILURE", "CANCELLED", "EXPIRED"].includes(status)) {
        return { upstreamTaskId, status: "failed", error: error || "AutoDL 视频生成失败" };
    }
    if (status === "RUNNING") return { upstreamTaskId, status: "in_progress" };
    if (status === "QUEUED" || upstreamTaskId) return { upstreamTaskId, status: "queued" };

    const code = stringValue(envelope.code).toUpperCase();
    if (code && code !== "SUCCESS") return { status: "failed", error: error || "AutoDL 请求失败" };
    return { status: "failed", error: error || "AutoDL 返回了无法识别的任务状态" };
}

export async function parseUnifiedVideoInput(raw: Buffer, contentType: string): Promise<{ model: string } & AutoDlVideoInput> {
    if (contentType.toLowerCase().includes("multipart/form-data")) {
        const request = new Request("http://gateway.local/v1/videos", { method: "POST", headers: { "content-type": contentType }, body: raw });
        const form = await request.formData();
        const referenceImages = await Promise.all(form.getAll("reference_images").map(formValueToMediaInput));
        const referenceAudios = await Promise.all(form.getAll("reference_audios").map(formValueToMediaInput));
        return {
            model: formString(form, "model"),
            prompt: formString(form, "prompt"),
            duration: formString(form, "seconds"),
            resolution: formString(form, "resolution_name"),
            size: formString(form, "size"),
            referenceImages,
            referenceAudios,
        };
    }

    let body: JsonObject;
    try {
        const parsed = JSON.parse(raw.toString("utf8")) as unknown;
        body = isObject(parsed) ? parsed : {};
    } catch {
        throw new Error("AutoDL 视频请求不是有效的 JSON 或 multipart 数据");
    }
    const referenceImages = Array.isArray(body.reference_images) ? body.reference_images.filter((value): value is string => typeof value === "string") : [];
    const referenceAudios = Array.isArray(body.reference_audios) ? body.reference_audios.filter((value): value is string => typeof value === "string") : [];
    return {
        model: stringValue(body.model),
        prompt: stringValue(body.prompt),
        duration: stringValue(body.seconds),
        resolution: stringValue(body.resolution_name),
        size: stringValue(body.size),
        referenceImages,
        referenceAudios,
    };
}

export function autoDlCreateUrl(baseUrl: string, workflowId: string) {
    return `${trimBaseUrl(baseUrl)}/comfyui_workflow/${encodeURIComponent(workflowId)}`;
}

export function autoDlResultUrl(baseUrl: string, taskId: string) {
    return `${trimBaseUrl(baseUrl)}/comfyui_workflow/result/${encodeURIComponent(taskId)}`;
}

export async function submitAutoDlWorkflow(baseUrl: string, token: string, workflow: { workflowId: string; body: JsonObject }) {
    const response = await fetch(autoDlCreateUrl(baseUrl, workflow.workflowId), {
        method: "POST",
        headers: { authorization: token, "content-type": "application/json" },
        body: JSON.stringify(workflow.body),
    });
    return { response, task: normalizeAutoDlTask(await response.json().catch(() => null)) };
}

export async function queryAutoDlWorkflow(baseUrl: string, token: string, taskId: string) {
    const response = await fetch(autoDlResultUrl(baseUrl, taskId), { headers: { authorization: token } });
    return { response, task: normalizeAutoDlTask(await response.json().catch(() => null)) };
}

function readAutoDlModelOptions(options: JsonObject): AutoDlModelOptions {
    const autodl = isObject(options.autodl) ? options.autodl : {};
    const workflowId = stringValue(autodl.workflowId).trim();
    if (!workflowId) throw new Error("AutoDL 模型缺少 workflowId");
    if (!isObject(autodl.requestTemplate)) throw new Error("AutoDL 模型缺少 requestTemplate");
    return {
        workflowId,
        requestTemplate: autodl.requestTemplate,
        durationMap: isObject(autodl.durationMap) ? autodl.durationMap : {},
        resolutionMap: isObject(autodl.resolutionMap) ? autodl.resolutionMap : {},
        minReferenceImages: Number.isFinite(Number(autodl.minReferenceImages)) ? Math.max(0, Number(autodl.minReferenceImages)) : 0,
        maxReferenceImages: optionalNonNegativeNumber(autodl.maxReferenceImages),
        minReferenceAudios: Number.isFinite(Number(autodl.minReferenceAudios)) ? Math.max(0, Number(autodl.minReferenceAudios)) : 0,
        maxReferenceAudios: optionalNonNegativeNumber(autodl.maxReferenceAudios),
        promptRequired: autodl.promptRequired !== false,
        constants: isObject(autodl.constants) ? autodl.constants : {},
    };
}

function mappedValue(map: JsonObject, key: string, label: string) {
    if (Object.prototype.hasOwnProperty.call(map, key)) return map[key];
    throw new Error(`AutoDL 不支持${label} ${key || "（空）"}`);
}

function mappedResolution(map: JsonObject, resolution: string, size: string) {
    const aspect = videoAspect(size);
    const keys = [size ? `${resolution}|${size}` : "", aspect ? `${resolution}|${aspect}` : "", resolution].filter(Boolean);
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(map, key)) return map[key];
    }
    return mappedValue(map, resolution, "分辨率");
}

function videoAspect(size: string) {
    if (!size) return "";
    const match = size.match(/^(\d+)x(\d+)$/i);
    if (!match) return "";
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!width || !height) return "";
    if (Math.abs(width - height) / Math.max(width, height) < 0.02) return "square";
    return width > height ? "horizontal" : "vertical";
}

function optionalNonNegativeNumber(value: unknown) {
    return value !== undefined && value !== null && Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : undefined;
}

function resolveTemplate(value: unknown, values: JsonObject): unknown {
    if (Array.isArray(value)) return value.map((item) => resolveTemplate(item, values));
    if (isObject(value)) {
        const entries: Array<[string, unknown]> = [];
        for (const [key, item] of Object.entries(value)) {
            const resolved = resolveTemplate(item, values);
            if (resolved !== undefined) entries.push([key, resolved]);
        }
        return Object.fromEntries(entries);
    }
    if (typeof value !== "string") return value;
    const exact = value.match(/^\{\{([A-Za-z][A-Za-z0-9_]*)\}\}$/);
    if (exact) return templateValue(values, exact[1]);
    return value.replace(/\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g, (_match, name: string) => String(templateValue(values, name)));
}

function templateValue(values: JsonObject, name: string) {
    if (!Object.prototype.hasOwnProperty.call(values, name)) throw new Error(`AutoDL requestTemplate 使用了未知占位符 {{${name}}}`);
    return values[name];
}

function firstResultUrl(results: unknown) {
    if (!Array.isArray(results)) return undefined;
    for (const result of results) {
        if (typeof result === "string" && /^https?:\/\//i.test(result)) return result;
        if (!isObject(result)) continue;
        for (const key of ["url", "video_url", "result_url"] as const) {
            const candidate = stringValue(result[key]);
            if (/^https?:\/\//i.test(candidate)) return candidate;
        }
    }
    return undefined;
}

function readMessage(value: JsonObject) {
    const error = value.error;
    return stringValue(value.message) || stringValue(value.msg) || (typeof error === "string" ? error : isObject(error) ? stringValue(error.message) : "");
}

async function formValueToMediaInput(value: FormDataEntryValue) {
    if (typeof value === "string") return value;
    const bytes = Buffer.from(await value.arrayBuffer());
    return `data:${value.type || "application/octet-stream"};base64,${bytes.toString("base64")}`;
}

function formString(form: FormData, name: string) {
    const value = form.get(name);
    return typeof value === "string" ? value : "";
}

function trimBaseUrl(baseUrl: string) {
    return baseUrl.trim().replace(/\/+$/, "");
}

function stringValue(value: unknown) {
    return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

function isObject(value: unknown): value is JsonObject {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
