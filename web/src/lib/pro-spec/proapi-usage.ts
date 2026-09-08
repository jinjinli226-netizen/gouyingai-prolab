import { inferModelInfo } from "./model-inference";
import { browserProxyBaseUrl } from "./constants";

export type ProApiTokenUsage = {
    name?: string;
    totalGranted: number;
    totalUsed: number;
    totalAvailable: number;
    unlimitedQuota: boolean;
    modelLimitsEnabled: boolean;
    modelLimits: string[];
    expiresAt: number;
};

export type ModelCategorySummary = {
    total: number;
    image: number;
    video: number;
    chat: number;
    audio: number;
    other: number;
};

type UsageEnvelope = {
    success?: boolean;
    message?: string;
    data?: unknown;
    error?: { message?: string };
};

type FetchUsageOptions = {
    baseUrl: string;
    apiKey: string;
    signal?: AbortSignal;
};

export async function fetchProApiTokenUsage({ baseUrl, apiKey, signal }: FetchUsageOptions): Promise<ProApiTokenUsage> {
    if (!apiKey.trim()) throw new Error("请先填写 API Key");

    const response = await fetch(`${browserProxyBaseUrl(proApiRootUrl(baseUrl))}/api/usage/token`, {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey.trim()}` },
        signal,
    });
    const payload = (await response.json().catch(() => ({}))) as UsageEnvelope;
    if (!response.ok) throw new Error(payload.message || payload.error?.message || `额度查询失败：HTTP ${response.status}`);
    if (payload.success === false) throw new Error(payload.message || payload.error?.message || "额度查询失败");

    return normalizeUsageData(payload.data || payload);
}

export function proApiRootUrl(baseUrl: string) {
    const trimmed = baseUrl.trim().replace(/\/+$/, "");
    return trimmed.toLowerCase().endsWith("/v1") ? trimmed.slice(0, -3) : trimmed;
}

export function summarizeModelCategories(modelIds: string[]): ModelCategorySummary {
    return modelIds.reduce(
        (summary, modelId) => {
            const category = inferModelInfo(modelId).category;
            if (category === "image") summary.image += 1;
            else if (category === "video") summary.video += 1;
            else if (category === "chat") summary.chat += 1;
            else summary.other += 1;
            summary.total += 1;
            return summary;
        },
        { total: 0, image: 0, video: 0, chat: 0, audio: 0, other: 0 },
    );
}

export function formatUsageAmount(value: number) {
    if (!Number.isFinite(value)) return "-";
    if (Math.abs(value) >= 100) return `$${value.toFixed(2)}`;
    if (Math.abs(value) >= 1) return `$${value.toFixed(4)}`;
    return `$${value.toFixed(6)}`;
}

function normalizeUsageData(data: unknown): ProApiTokenUsage {
    if (!data || typeof data !== "object") throw new Error("额度响应格式不正确");
    const value = data as Record<string, unknown>;
    return {
        name: typeof value.name === "string" ? value.name : undefined,
        totalGranted: numberValue(value.total_granted),
        totalUsed: numberValue(value.total_used),
        totalAvailable: numberValue(value.total_available),
        unlimitedQuota: value.unlimited_quota === true,
        modelLimitsEnabled: value.model_limits_enabled === true,
        modelLimits: Array.isArray(value.model_limits) ? value.model_limits.filter((item): item is string => typeof item === "string") : [],
        expiresAt: numberValue(value.expires_at, -1),
    };
}

function numberValue(value: unknown, fallback = 0) {
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? number : fallback;
}
