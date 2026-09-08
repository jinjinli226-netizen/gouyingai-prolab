import type { Channel, Model, PublicModel } from "./types.js";

export const MODEL_CAPABILITY_HEADER = "x-gouyingai-capability";

export function normalizeProviderBaseUrl(baseUrl: string) {
    const trimmed = baseUrl.trim().replace(/\/+$/, "");
    const lower = trimmed.toLowerCase();
    if (lower.endsWith("/v1") || lower.endsWith("/api/v3") || lower.endsWith("/api/plan/v3")) return trimmed;
    return `${trimmed}/v1`;
}

export function buildUpstreamUrl(baseUrl: string, providerPath: string) {
    const normalized = normalizeProviderBaseUrl(baseUrl);
    const path = providerPath.startsWith("/") ? providerPath : `/${providerPath}`;
    return `${normalized}${path}`;
}

export function toPublicModel(model: Model, channel?: Channel): PublicModel {
    return {
        id: model.model_name,
        bindingId: model.id,
        modelName: model.model_name,
        displayName: model.display_name,
        capability: model.capability,
        options: model.options || {},
        ...(channel ? { channelId: channel.id, channelName: channel.name, channelBaseUrl: channel.base_url } : {}),
    };
}

export function pickModelByName(models: Model[], name: string) {
    return unambiguousPublishedModels(models).find((model) => model.model_name === name);
}

/** A duplicate public name has no stable upstream target, so it must never be routed. */
export function unambiguousPublishedModels<T extends Pick<Model, "model_name" | "published">>(models: T[]) {
    const counts = new Map<string, number>();
    for (const model of models) {
        if (model.published) counts.set(model.model_name, (counts.get(model.model_name) || 0) + 1);
    }
    return models.filter((model) => model.published && counts.get(model.model_name) === 1);
}

export function parseModelCapability(value: unknown): Model["capability"] | undefined {
    const raw = Array.isArray(value) ? value[0] : value;
    const capability = typeof raw === "string" ? raw.trim().toLowerCase() : "";
    return capability === "image" || capability === "video" || capability === "text" || capability === "audio" ? capability : undefined;
}

export function pickChannelById(channels: Channel[], id: string) {
    return channels.find((channel) => channel.id === id && channel.enabled);
}

export function extractModelNameFromJson(body: string) {
    try {
        const parsed = JSON.parse(body) as { model?: unknown; model_name?: unknown };
        const value = typeof parsed.model === "string" ? parsed.model : typeof parsed.model_name === "string" ? parsed.model_name : "";
        return value;
    } catch {
        return "";
    }
}

export function extractModelNameFromMultipart(body: Buffer) {
    const text = body.toString("utf8");
    const match = text.match(/name="model"\r\n\r\n([^\r\n]+)/);
    return match?.[1]?.trim() || "";
}
