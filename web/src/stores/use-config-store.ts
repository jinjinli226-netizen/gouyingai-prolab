import { useMemo } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { nanoid } from "nanoid";

import { localForageStorage } from "@/lib/localforage-storage";
import { browserProxyBaseUrl } from "@/lib/pro-spec/constants";
import { inferModelInfo } from "@/lib/pro-spec/model-inference";
import { gatewayBaseUrl, isGatewayConfigured } from "@/services/gateway-admin";
import { isSupabaseConfigured } from "@/services/supabase-client";
import { useUserStore } from "@/stores/use-user-store";

/** 网关托管模型 -> 真实上游来源（由 applyServerModels 从模型目录填充，仅内存态） */
const gatewayModelSources = new Map<string, { name: string; baseUrl: string }>();
const gatewayModelCatalog = new Map<string, { displayName: string; options: Record<string, unknown> }>();

export type ApiCallFormat = "openai" | "gemini";

export type ModelChannel = {
    id: string;
    name: string;
    baseUrl: string;
    apiKey: string;
    apiFormat: ApiCallFormat;
    models: string[];
    /** Gateway catalog metadata. Local channels intentionally leave this unset. */
    modelCapabilities?: Partial<Record<string, ModelCapability>>;
};

export type AiConfig = {
    channelMode: "remote" | "local";
    /** Set only on a resolved request so the gateway can verify model capability. */
    requestCapability?: ModelCapability;
    baseUrl: string;
    apiKey: string;
    apiFormat: ApiCallFormat;
    channels: ModelChannel[];
    model: string;
    imageModel: string;
    videoModel: string;
    textModel: string;
    audioModel: string;
    audioVoice: string;
    audioFormat: string;
    audioSpeed: string;
    audioInstructions: string;
    videoSeconds: string;
    vquality: string;
    videoGenerateAudio: string;
    videoWatermark: string;
    videoInputMode: "auto" | "first-last" | "lip-sync";
    systemPrompt: string;
    models: string[];
    imageModels: string[];
    videoModels: string[];
    textModels: string[];
    audioModels: string[];
    quality: string;
    size: string;
    count: string;
    canvasImageCount: string;
};

export type WebdavSyncConfig = {
    url: string;
    username: string;
    password: string;
    directory: string;
    lastSyncedAt: string;
};
export type ConfigTabKey = "preferences" | "webdav" | "codex";

export const CONFIG_STORE_KEY = "gouyingai:ai_config_store";
export type ModelCapability = "image" | "video" | "text" | "audio";
const CHANNEL_MODEL_SEPARATOR = "::";
const OPENAI_BASE_URL = "";
const GEMINI_BASE_URL = "";

export const defaultConfig: AiConfig = {
    channelMode: "local",
    baseUrl: OPENAI_BASE_URL,
    apiKey: "",
    apiFormat: "openai",
    channels: [
        {
            id: "default",
            name: "默认渠道",
            baseUrl: OPENAI_BASE_URL,
            apiKey: "",
            apiFormat: "openai",
            models: [],
        },
    ],
    model: "",
    imageModel: "",
    videoModel: "",
    textModel: "",
    audioModel: "",
    audioVoice: "alloy",
    audioFormat: "mp3",
    audioSpeed: "1",
    audioInstructions: "",
    videoSeconds: "6",
    vquality: "768",
    videoGenerateAudio: "true",
    videoWatermark: "false",
    videoInputMode: "auto",
    systemPrompt: "",
    models: [],
    imageModels: [],
    videoModels: [],
    textModels: [],
    audioModels: [],
    quality: "auto",
    size: "1:1",
    count: "1",
    canvasImageCount: "3",
};

export const defaultWebdavSyncConfig: WebdavSyncConfig = {
    url: "",
    username: "",
    password: "",
    directory: "gouyingai",
    lastSyncedAt: "",
};

type ConfigStore = {
    hydrated: boolean;
    config: AiConfig;
    webdav: WebdavSyncConfig;
    isConfigOpen: boolean;
    configTab: ConfigTabKey;
    shouldPromptContinue: boolean;
    updateConfig: <K extends keyof AiConfig>(key: K, value: AiConfig[K]) => void;
    applyServerModels: (catalog: Array<{ modelName: string; displayName: string; capability: ModelCapability; options?: Record<string, unknown>; channelName?: string; channelBaseUrl?: string }>) => void;
    updateWebdavConfig: <K extends keyof WebdavSyncConfig>(key: K, value: WebdavSyncConfig[K]) => void;
    isAiConfigReady: (config: AiConfig, model: string) => boolean;
    openConfigDialog: (shouldPromptContinue?: boolean, tab?: ConfigTabKey) => void;
    setConfigDialogOpen: (isOpen: boolean) => void;
    clearPromptContinue: () => void;
};

function isVideoModelName(model: string) {
    return inferModelInfo(modelOptionName(model)).category === "video";
}

function isImageModelName(model: string) {
    return inferModelInfo(modelOptionName(model)).category === "image";
}

function isAudioModelName(model: string) {
    const value = modelOptionName(model).toLowerCase();
    return value.includes("audio") || value.includes("tts") || value.includes("speech") || value.includes("voice") || value.includes("music") || value.includes("sound");
}

function isTextModelName(model: string) {
    return !isAudioModelName(model) && inferModelInfo(modelOptionName(model)).category === "chat";
}

export function modelMatchesCapability(model: string, capability?: ModelCapability) {
    if (!capability) return true;
    if (capability === "image") return isImageModelName(model);
    if (capability === "video") return isVideoModelName(model);
    if (capability === "audio") return isAudioModelName(model);
    return isTextModelName(model);
}

export function filterModelsByCapability(models: string[], capability?: ModelCapability) {
    return capability ? models.filter((model) => modelMatchesCapability(model, capability)) : models;
}

export function selectableModelsByCapability(config: AiConfig, capability?: ModelCapability) {
    if (!capability) return config.models;
    const configured = config[modelListKey(capability)];
    const options = Array.isArray(configured) ? configured : filterModelsByCapability(config.models, capability);
    return options.filter((model) => modelAllowsCapability(config, model, capability));
}

/** Models that may be assigned to a capability. Gateway catalog metadata overrides name inference. */
export function modelsAvailableForCapability(config: AiConfig, capability: ModelCapability) {
    return config.models.filter((model) => modelAllowsCapability(config, model, capability));
}

/** True only when the exact model/channel option belongs to the requested capability. */
export function modelConfiguredForCapability(config: AiConfig, model: string, capability: ModelCapability) {
    let modelValue: string;
    try {
        modelValue = resolveExplicitModelValue(config, model);
    } catch {
        return false;
    }
    if (!modelAllowsCapability(config, modelValue, capability)) return false;
    return selectableModelsByCapability(config, capability).some((option) => {
        try {
            return resolveExplicitModelValue(config, option) === modelValue;
        } catch {
            return false;
        }
    });
}

function modelAllowsCapability(config: AiConfig, model: string, capability: ModelCapability) {
    const decoded = decodeChannelModel(model);
    if (!decoded) return true;
    const channel = config.channels.find((item) => item.id === decoded.channelId);
    const knownCapability = channel?.modelCapabilities?.[decoded.model];
    return !knownCapability || knownCapability === capability;
}

function modelListKey(capability: ModelCapability) {
    return `${capability}Models` as "imageModels" | "videoModels" | "textModels" | "audioModels";
}

function isAiConfigReady(config: AiConfig, model: string) {
    if (!model.trim()) return false;
    let modelValue: string;
    let channel: ModelChannel;
    try {
        modelValue = resolveExplicitModelValue(config, model);
        channel = resolveModelChannel(config, modelValue);
    } catch {
        return false;
    }
    if (channel.baseUrl === gatewayBaseUrl && isGatewayConfigured) {
        const hasUser = isSupabaseConfigured ? Boolean(useUserStore.getState().accessToken) : true;
        return Boolean(modelOptionName(modelValue).trim() && hasUser);
    }
    return Boolean(modelOptionName(modelValue).trim() && channel.baseUrl.trim() && channel.apiKey.trim());
}

export const useConfigStore = create<ConfigStore>()(
    persist(
        (set, get) => ({
            hydrated: false,
            config: defaultConfig,
            webdav: defaultWebdavSyncConfig,
            isConfigOpen: false,
            configTab: "preferences",
            shouldPromptContinue: false,
            updateConfig: (key, value) =>
                set((state) => ({
                    config: {
                        ...state.config,
                        [key]: value,
                    },
                })),
            applyServerModels: (catalog) =>
                set((state) => {
                    gatewayModelSources.clear();
                    gatewayModelCatalog.clear();
                    const modelNameCounts = new Map<string, number>();
                    for (const item of catalog) modelNameCounts.set(item.modelName, (modelNameCounts.get(item.modelName) || 0) + 1);
                    const unambiguousCatalog = catalog.filter((item) => modelNameCounts.get(item.modelName) === 1);
                    for (const item of unambiguousCatalog) {
                        gatewayModelCatalog.set(item.modelName, { displayName: item.displayName, options: item.options || {} });
                        if (item.channelName || item.channelBaseUrl) {
                            gatewayModelSources.set(item.modelName, { name: item.channelName || "", baseUrl: item.channelBaseUrl || "" });
                        }
                    }
                    const channel: ModelChannel = {
                        id: "gouyingai-platform",
                        name: "GouYingAi 平台模型",
                        baseUrl: gatewayBaseUrl,
                        apiKey: "",
                        apiFormat: "openai",
                        models: unambiguousCatalog.map((item) => item.modelName),
                        modelCapabilities: Object.fromEntries(unambiguousCatalog.map((item) => [item.modelName, item.capability])),
                    };
                    const next = configWithChannels({ ...state.config, channels: [channel] }, [channel]);
                    const modelOptions = Array.from(new Set(unambiguousCatalog.map((item) => encodeChannelModel(channel.id, item.modelName))));
                    const optionsFor = (capability: ModelCapability) => Array.from(new Set(unambiguousCatalog.filter((item) => item.capability === capability).map((item) => encodeChannelModel(channel.id, item.modelName))));
                    const imageModels = optionsFor("image");
                    const videoModels = optionsFor("video");
                    const textModels = optionsFor("text");
                    const audioModels = optionsFor("audio");
                    const firstImage = imageModels[0] || "";
                    const firstVideo = videoModels[0] || "";
                    const firstText = textModels[0] || "";
                    const firstAudio = audioModels[0] || "";
                    return {
                        config: {
                            ...next,
                            models: modelOptions,
                            imageModels,
                            videoModels,
                            textModels,
                            audioModels,
                            model: "",
                            imageModel: firstImage,
                            videoModel: firstVideo,
                            textModel: firstText,
                            audioModel: firstAudio,
                        },
                    };
                }),
            updateWebdavConfig: (key, value) =>
                set((state) => ({
                    webdav: {
                        ...state.webdav,
                        [key]: value,
                    },
                })),
            isAiConfigReady: (config, model) => isAiConfigReady(config, model),
            openConfigDialog: (shouldPromptContinue = false, configTab = "preferences") => set({ isConfigOpen: true, shouldPromptContinue, configTab }),
            setConfigDialogOpen: (isConfigOpen) => set({ isConfigOpen }),
            clearPromptContinue: () => set({ shouldPromptContinue: false }),
        }),
        {
            name: CONFIG_STORE_KEY,
            storage: createJSONStorage(() => localForageStorage),
            partialize: (state) => ({ config: state.config, webdav: state.webdav }),
            merge: (persisted, current) => {
                const persistedState = (persisted || {}) as Partial<ConfigStore>;
                const persistedConfig = (persistedState.config || {}) as Partial<AiConfig>;
                const persistedWebdav = (persistedState.webdav || {}) as Partial<WebdavSyncConfig>;
                const config = { ...defaultConfig, ...persistedConfig };
                if (!Array.isArray(persistedConfig.channels)) config.channels = [];
                const channels = isGatewayConfigured
                    ? [
                          createModelChannel({
                              id: "gouyingai-platform",
                              name: "GouYingAi 平台模型",
                              baseUrl: gatewayBaseUrl,
                              apiKey: "",
                              apiFormat: "openai",
                              models: [],
                          }),
                      ]
                    : normalizeChannels(config);
                const models = modelOptionsFromChannels(channels);
                return {
                    ...current,
                    webdav: { ...defaultWebdavSyncConfig, ...persistedWebdav },
                    config: {
                        ...config,
                        channelMode: "local",
                        apiFormat: normalizeApiFormat(config.apiFormat),
                        channels,
                        models,
                        imageModel: isGatewayConfigured ? "" : normalizeModelOptionValue(config.imageModel, channels),
                        videoModel: isGatewayConfigured ? "" : normalizeModelOptionValue(config.videoModel, channels),
                        textModel: isGatewayConfigured ? "" : normalizeModelOptionValue(config.textModel, channels),
                        audioModel: isGatewayConfigured ? "" : normalizeModelOptionValue(config.audioModel, channels),
                        audioVoice: config.audioVoice || defaultConfig.audioVoice,
                        audioFormat: config.audioFormat || defaultConfig.audioFormat,
                        audioSpeed: config.audioSpeed || defaultConfig.audioSpeed,
                        audioInstructions: config.audioInstructions || "",
                        videoSeconds: config.videoSeconds || "6",
                        vquality: config.vquality === "720" ? defaultConfig.vquality : config.vquality || defaultConfig.vquality,
                        videoGenerateAudio: config.videoGenerateAudio || "true",
                        videoWatermark: config.videoWatermark || "false",
                        videoInputMode: config.videoInputMode || "auto",
                        canvasImageCount: config.canvasImageCount || "3",
                        imageModels: isGatewayConfigured ? [] : mergeSuggestedModelOptions(Array.isArray(persistedConfig.imageModels) ? normalizeModelList(config.imageModels, channels) : [], filterModelsByCapability(models, "image")),
                        videoModels: isGatewayConfigured ? [] : mergeSuggestedModelOptions(Array.isArray(persistedConfig.videoModels) ? normalizeModelList(config.videoModels, channels) : [], filterModelsByCapability(models, "video")),
                        textModels: isGatewayConfigured ? [] : mergeSuggestedModelOptions(Array.isArray(persistedConfig.textModels) ? normalizeModelList(config.textModels, channels) : [], filterModelsByCapability(models, "text")),
                        audioModels: isGatewayConfigured ? [] : mergeSuggestedModelOptions(Array.isArray(persistedConfig.audioModels) ? normalizeModelList(config.audioModels, channels) : [], filterModelsByCapability(models, "audio")),
                    },
                };
            },
            onRehydrateStorage: () => () => {
                useConfigStore.setState({ hydrated: true });
            },
        },
    ),
);

function normalizeModelList(models: string[], channels: ModelChannel[]) {
    const allModelOptions = channels.flatMap((channel) => channel.models.map((model) => encodeChannelModel(channel.id, model)));
    return Array.from(new Set((models || []).map((model) => model.trim()).filter(Boolean)))
        .map((model) => normalizeModelOptionValue(model, channels))
        .filter((model) => !allModelOptions.length || allModelOptions.includes(model) || !isChannelModelValue(model));
}

export function mergeSuggestedModelOptions(current: string[], suggested: string[]) {
    return Array.from(new Set([...(current || []), ...(suggested || [])].map((model) => model.trim()).filter(Boolean)));
}

export function useEffectiveConfig() {
    const config = useConfigStore((state) => state.config);
    return useMemo(() => ({ ...config, channelMode: "local" as const }), [config]);
}

export function createModelChannel(channel?: Partial<ModelChannel>): ModelChannel {
    const apiFormat = normalizeApiFormat(channel?.apiFormat);
    return {
        id: channel?.id?.trim() || nanoid(),
        name: channel?.name?.trim() || "新渠道",
        baseUrl: channel?.baseUrl === undefined ? defaultBaseUrlForApiFormat(apiFormat) : channel.baseUrl.trim(),
        apiKey: channel?.apiKey || "",
        apiFormat,
        models: uniqueRawModels(channel?.models || []),
        ...(channel?.modelCapabilities ? { modelCapabilities: { ...channel.modelCapabilities } } : {}),
    };
}

export function encodeChannelModel(channelId: string, model: string) {
    return `${channelId}${CHANNEL_MODEL_SEPARATOR}${model.trim()}`;
}

export function isChannelModelValue(value: string) {
    return value.includes(CHANNEL_MODEL_SEPARATOR);
}

export function decodeChannelModel(value: string) {
    const index = value.indexOf(CHANNEL_MODEL_SEPARATOR);
    if (index < 0) return null;
    return { channelId: value.slice(0, index), model: value.slice(index + CHANNEL_MODEL_SEPARATOR.length) };
}

export function modelOptionName(value: string) {
    return decodeChannelModel(value)?.model || value;
}

export function gatewayModelCatalogEntry(value: string) {
    return gatewayModelCatalog.get(modelOptionName(value));
}

export function gatewayModelCatalogEntries(values: string[]) {
    return values.map((model) => ({
        model,
        displayName: modelOptionDisplayName(model),
        options: gatewayModelCatalogEntry(model)?.options || {},
    }));
}

export function modelOptionDisplayName(value: string) {
    return gatewayModelCatalogEntry(value)?.displayName || modelOptionName(value);
}

export function modelOptionLabel(config: AiConfig, value: string) {
    const decoded = decodeChannelModel(value);
    if (!decoded) return value;
    const channel = config.channels.find((item) => item.id === decoded.channelId);
    return channel ? `${decoded.model}（${modelOptionSourceLabel(config, value)}）` : decoded.model;
}

export function modelOptionSourceLabel(config: AiConfig, value: string) {
    const decoded = decodeChannelModel(value);
    const channel = decoded ? config.channels.find((item) => item.id === decoded.channelId) : resolveModelChannel(config, value);
    if (!channel) return "未绑定渠道";
    if (channel.baseUrl === gatewayBaseUrl && isGatewayConfigured) {
        const source = gatewayModelSources.get(modelOptionName(value));
        const channelName = channel.name || "GouYingAi 平台模型";
        return source?.baseUrl ? `${channelName} · ${endpointHost(source.baseUrl)}` : channelName;
    }
    return channelSourceLabel(config, channel);
}

export function modelOptionSearchText(config: AiConfig, value: string) {
    return `${modelOptionName(value)} ${modelOptionSourceLabel(config, value)} ${modelOptionLabel(config, value)}`;
}

export function channelSourceLabel(config: AiConfig, channel: ModelChannel) {
    if (channel.baseUrl === gatewayBaseUrl && isGatewayConfigured) {
        return channel.name || "GouYingAi 平台模型";
    }
    const index = config.channels.findIndex((item) => item.id === channel.id);
    const name = `${channel.name || "未命名渠道"} #${index >= 0 ? index + 1 : "?"}`;
    return [name, endpointHost(channel.baseUrl), apiKeyFingerprint(channel.apiKey)].filter(Boolean).join(" · ");
}

export function apiKeyFingerprint(apiKey: string) {
    const value = apiKey.trim();
    if (!value) return "未填 Key";
    return `Key ...${value.slice(-4)}`;
}

export function modelOptionsFromChannels(channels: ModelChannel[]) {
    return uniqueModelOptions(channels.flatMap((channel) => channel.models.map((model) => encodeChannelModel(channel.id, model))));
}

export function normalizeModelOptionValue(value: string | undefined, channels: ModelChannel[]) {
    const model = (value || "").trim();
    if (!model) return "";
    const decoded = decodeChannelModel(model);
    if (decoded) {
        const channel = channels.find((item) => item.id === decoded.channelId);
        if (channel && channel.models.includes(decoded.model)) return model;
        return "";
    }
    const matchingChannels = channels.filter((channel) => channel.models.includes(model));
    return matchingChannels.length === 1 ? encodeChannelModel(matchingChannels[0].id, model) : "";
}

/** An explicitly requested model remains explicit even when it is no longer routable. */
export function normalizeRequestedModelOption(config: Pick<AiConfig, "channels">, requestedModel: string | undefined, defaultModel: string) {
    const candidate = requestedModel?.trim() ? requestedModel : defaultModel;
    return normalizeModelOptionValue(candidate, config.channels) || candidate.trim();
}

export function resolveModelChannel(config: AiConfig, value: string) {
    const decoded = decodeChannelModel(value);
    const model = decoded?.model || value;
    const matched = decoded ? config.channels.find((channel) => channel.id === decoded.channelId) : config.channels.find((channel) => channel.models.includes(model));
    return matched || config.channels[0] || createModelChannel({ id: "default", name: "默认渠道", baseUrl: config.baseUrl, apiKey: config.apiKey, apiFormat: config.apiFormat, models: config.models.map(modelOptionName) });
}

export function resolveModelRequestConfig(config: AiConfig, value: string) {
    const modelValue = resolveExplicitModelValue(config, value);
    const channel = resolveModelChannel(config, modelValue);
    if (channel.baseUrl === gatewayBaseUrl && isGatewayConfigured) {
        return {
            ...config,
            requestCapability: undefined,
            model: modelOptionName(modelValue),
            baseUrl: gatewayBaseUrl,
            apiKey: useUserStore.getState().accessToken,
            apiFormat: "openai" as const,
        };
    }
    return {
        ...config,
        requestCapability: undefined,
        model: modelOptionName(modelValue),
        baseUrl: channel.baseUrl,
        apiKey: channel.apiKey,
        apiFormat: channel.apiFormat,
    };
}

/** Resolve only the model assigned to the requested capability; never borrow another capability's model. */
export function resolveModelRequestConfigForCapability(config: AiConfig, capability: ModelCapability) {
    const modelKey = `${capability}Model` as "imageModel" | "videoModel" | "textModel" | "audioModel";
    const selectedModel = config[modelKey]?.trim();
    if (!selectedModel) throw new Error(`No ${capability} model configured`);
    let modelValue: string;
    try {
        modelValue = resolveExplicitModelValue(config, selectedModel);
    } catch {
        throw new Error(`Selected ${capability} model is unavailable`);
    }
    if (!modelConfiguredForCapability(config, modelValue, capability)) throw new Error(`Selected model is not configured for ${capability}`);
    const requestConfig = resolveModelRequestConfig(config, modelValue);
    return requestConfig.baseUrl === gatewayBaseUrl && isGatewayConfigured ? { ...requestConfig, requestCapability: capability } : requestConfig;
}

export function modelCapabilityHeaders(config: Pick<AiConfig, "requestCapability">): Record<string, string> {
    return config.requestCapability ? { "X-GouYingAi-Capability": config.requestCapability } : {};
}

export function withModelCapabilityHeader(config: Pick<AiConfig, "requestCapability">, init: RequestInit): RequestInit {
    const headers = new Headers(init.headers);
    for (const [key, value] of Object.entries(modelCapabilityHeaders(config))) headers.set(key, value);
    return { ...init, headers };
}

function resolveExplicitModelValue(config: AiConfig, value: string | undefined) {
    const requested = (value || "").trim();
    if (!requested) throw new Error("No model configured");
    const decoded = decodeChannelModel(requested);
    if (decoded) {
        const channel = config.channels.find((item) => item.id === decoded.channelId);
        if (!channel || !channel.models.includes(decoded.model)) throw new Error("Selected model is unavailable");
        return requested;
    }
    const matches = config.channels.filter((channel) => channel.models.includes(requested));
    if (!matches.length) throw new Error("Selected model is unavailable");
    if (matches.length > 1) throw new Error("Selected model is ambiguous");
    return encodeChannelModel(matches[0].id, requested);
}

export function configWithChannels(config: AiConfig, channels: ModelChannel[]): AiConfig {
    const normalizedChannels = normalizeModelChannels(channels);
    const models = modelOptionsFromChannels(normalizedChannels);
    return {
        ...config,
        channelMode: "local",
        model: "",
        baseUrl: normalizedChannels[0]?.baseUrl || config.baseUrl,
        apiKey: normalizedChannels[0]?.apiKey || config.apiKey,
        apiFormat: normalizedChannels[0]?.apiFormat || config.apiFormat,
        channels: normalizedChannels,
        models,
        imageModels: filterModelsByCapability(models, "image"),
        videoModels: filterModelsByCapability(models, "video"),
        textModels: filterModelsByCapability(models, "text"),
        audioModels: filterModelsByCapability(models, "audio"),
    };
}

function normalizeChannels(config: AiConfig) {
    const persistedChannels = Array.isArray(config.channels) ? config.channels : [];
    const channels = persistedChannels.map((channel, index) =>
        createModelChannel({
            ...channel,
            id: channel.id || (index === 0 ? "default" : `channel-${index + 1}`),
            name: channel.name || (index === 0 ? "默认渠道" : `渠道 ${index + 1}`),
            models: uniqueRawModels(channel.models || []),
        }),
    );
    if (!channels.length) {
        channels.push(
            createModelChannel({
                id: "default",
                name: "默认渠道",
                baseUrl: config.baseUrl || defaultConfig.baseUrl,
                apiKey: config.apiKey || "",
                apiFormat: config.apiFormat || defaultConfig.apiFormat,
                models: uniqueRawModels([...(config.models || []), config.model, config.imageModel, config.videoModel, config.textModel, config.audioModel]),
            }),
        );
    }
    return normalizeModelChannels(channels);
}

function normalizeModelChannels(channels: ModelChannel[]) {
    return channels.map((channel) => ({ ...channel, models: uniqueRawModels(channel.models) }));
}

export function defaultBaseUrlForApiFormat(apiFormat: ApiCallFormat) {
    return apiFormat === "gemini" ? GEMINI_BASE_URL : OPENAI_BASE_URL;
}

function normalizeApiFormat(apiFormat: unknown): ApiCallFormat {
    return apiFormat === "gemini" ? "gemini" : "openai";
}

function uniqueRawModels(models: string[]) {
    return Array.from(new Set((models || []).map((model) => modelOptionName(model).trim()).filter(Boolean)));
}

function uniqueModelOptions(models: string[]) {
    return Array.from(new Set((models || []).map((model) => model.trim()).filter(Boolean)));
}

function endpointHost(baseUrl: string) {
    const value = baseUrl.trim();
    if (!value) return "";
    try {
        return new URL(value).host;
    } catch {
        return value.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    }
}

export function buildApiUrl(baseUrl: string, path: string) {
    let normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
    normalizedBaseUrl = normalizeArkPlanBaseUrl(normalizedBaseUrl);
    normalizedBaseUrl = browserProxyBaseUrl(normalizedBaseUrl);
    const lowerBaseUrl = normalizedBaseUrl.toLowerCase();
    const apiBaseUrl = lowerBaseUrl.endsWith("/v1") || lowerBaseUrl.endsWith("/api/v3") || lowerBaseUrl.endsWith("/api/plan/v3") ? normalizedBaseUrl : `${normalizedBaseUrl}/v1`;
    return `${apiBaseUrl}${path}`;
}

function normalizeArkPlanBaseUrl(baseUrl: string) {
    try {
        const url = new URL(baseUrl);
        const path = url.pathname.replace(/\/+$/, "");
        const lowerPath = path.toLowerCase();
        const arkPlanIndex = lowerPath.indexOf("/api/plan/v3");
        if (arkPlanIndex < 0) return baseUrl;
        const end = arkPlanIndex + "/api/plan/v3".length;
        if (lowerPath.length !== end && lowerPath[end] !== "/") return baseUrl;
        url.pathname = path.slice(0, end);
        url.search = "";
        url.hash = "";
        return url.toString().replace(/\/+$/, "");
    } catch {
        return baseUrl;
    }
}
