export const MODEL_CAPABILITY_HEADER = "x-gouyingai-capability";
export function normalizeProviderBaseUrl(baseUrl) {
    const trimmed = baseUrl.trim().replace(/\/+$/, "");
    const lower = trimmed.toLowerCase();
    if (lower.endsWith("/v1") || lower.endsWith("/api/v3") || lower.endsWith("/api/plan/v3"))
        return trimmed;
    return `${trimmed}/v1`;
}
export function buildUpstreamUrl(baseUrl, providerPath) {
    const normalized = normalizeProviderBaseUrl(baseUrl);
    const path = providerPath.startsWith("/") ? providerPath : `/${providerPath}`;
    return `${normalized}${path}`;
}
export function toPublicModel(model, channel) {
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
export function pickModelByName(models, name) {
    return unambiguousPublishedModels(models).find((model) => model.model_name === name);
}
/** A duplicate public name has no stable upstream target, so it must never be routed. */
export function unambiguousPublishedModels(models) {
    const counts = new Map();
    for (const model of models) {
        if (model.published)
            counts.set(model.model_name, (counts.get(model.model_name) || 0) + 1);
    }
    return models.filter((model) => model.published && counts.get(model.model_name) === 1);
}
export function parseModelCapability(value) {
    const raw = Array.isArray(value) ? value[0] : value;
    const capability = typeof raw === "string" ? raw.trim().toLowerCase() : "";
    return capability === "image" || capability === "video" || capability === "text" || capability === "audio" ? capability : undefined;
}
export function pickChannelById(channels, id) {
    return channels.find((channel) => channel.id === id && channel.enabled);
}
export function extractModelNameFromJson(body) {
    try {
        const parsed = JSON.parse(body);
        const value = typeof parsed.model === "string" ? parsed.model : typeof parsed.model_name === "string" ? parsed.model_name : "";
        return value;
    }
    catch {
        return "";
    }
}
export function extractModelNameFromMultipart(body) {
    const text = body.toString("utf8");
    const match = text.match(/name="model"\r\n\r\n([^\r\n]+)/);
    return match?.[1]?.trim() || "";
}
//# sourceMappingURL=catalog.js.map