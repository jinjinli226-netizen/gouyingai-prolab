import type { AiConfig } from "@/stores/use-config-store";

export type H3VideoInputMode = "auto" | "first-last" | "lip-sync";

export type H3CanvasVideoInput = {
    imageCount: number;
    audioCount: number;
    videoCount: number;
    duration: string;
    mode: H3VideoInputMode;
};

export type H3CanvasVideoResolution = {
    config: AiConfig;
    model: string;
    displayName: string;
    autoSelected: boolean;
};

export type H3VideoCatalogEntry = {
    model: string;
    displayName: string;
    options: Record<string, unknown>;
};

type H3RouteKind = "auto" | "text" | "multi-reference" | "first-last" | "multi-reference-audio" | "lip-sync";

type H3Route = {
    family: string;
    kind: H3RouteKind;
    minDuration: number;
    maxDuration: number;
    minImages: number;
    maxImages?: number;
    minAudios: number;
    maxAudios?: number;
};

const H3_FAMILY = "minimax-h3-autodl";

export function isAutoDlH3CanvasModel(options?: Record<string, unknown>) {
    return readRoute(options)?.family === H3_FAMILY;
}

export function autoDlH3CanvasModelKind(options?: Record<string, unknown>) {
    return readRoute(options)?.kind || null;
}

export function resolveAutoDlH3CanvasVideoConfig(config: AiConfig, input: H3CanvasVideoInput, catalog: H3VideoCatalogEntry[]): H3CanvasVideoResolution {
    const selected = config.videoModel.trim();
    const selectedEntry = catalog.find((entry) => entry.model === selected);
    const selectedRoute = readRoute(selectedEntry?.options);
    const selectedDisplayName = selectedEntry?.displayName || selected;
    if (!selectedRoute || selectedRoute.family !== H3_FAMILY) {
        return { config, model: selected, displayName: selectedDisplayName, autoSelected: false };
    }
    if (input.videoCount) throw new Error("MiniMax H3 AutoDL 工作流不支持参考视频节点，请移除参考视频");

    const duration = normalizeDuration(input.duration);
    if (selectedRoute.kind !== "auto") {
        validateRoute(selectedRoute, input.imageCount, input.audioCount, duration, selectedDisplayName);
        return { config, model: selected, displayName: selectedDisplayName, autoSelected: false };
    }

    const targetKind = targetRouteKind(input);
    const availableModels = new Set(config.videoModels);
    const candidates = catalog.flatMap((entry) => {
        if (!availableModels.has(entry.model)) return [];
        const route = readRoute(entry.options);
        if (!route || route.family !== selectedRoute.family || route.kind !== targetKind) return [];
        try {
            validateRoute(route, input.imageCount, input.audioCount, duration, entry.displayName);
            return [{ entry, route }];
        } catch {
            return [];
        }
    });
    if (!candidates.length) throw new Error(h3MissingRouteMessage(targetKind, duration));
    const smallestMaxDuration = Math.min(...candidates.map((candidate) => candidate.route.maxDuration));
    const best = candidates.filter((candidate) => candidate.route.maxDuration === smallestMaxDuration);
    if (best.length !== 1) throw new Error(`MiniMax H3 自动路由存在 ${best.length} 个同等匹配模型，请到管理后台检查重复配置`);

    const model = best[0].entry.model;
    return {
        config: { ...config, model, videoModel: model },
        model,
        displayName: best[0].entry.displayName,
        autoSelected: true,
    };
}

function targetRouteKind(input: H3CanvasVideoInput): Exclude<H3RouteKind, "auto"> {
    if (input.mode === "first-last") {
        if (input.imageCount !== 2 || input.audioCount) throw new Error("首尾帧模式必须恰好连接两张图片，且不能连接音频");
        return "first-last";
    }
    if (input.mode === "lip-sync") {
        if (input.imageCount !== 1 || input.audioCount !== 1) throw new Error("口型同步模式必须恰好连接一张人物图和一段音频");
        return "lip-sync";
    }
    if (input.audioCount) {
        if (!input.imageCount) throw new Error("多图多音频模式至少需要一张参考图");
        return "multi-reference-audio";
    }
    return input.imageCount ? "multi-reference" : "text";
}

function validateRoute(route: H3Route, imageCount: number, audioCount: number, duration: number, label: string) {
    if (duration < route.minDuration || duration > route.maxDuration) throw new Error(`${label} 仅支持 ${route.minDuration}–${route.maxDuration} 秒`);
    if (imageCount < route.minImages) throw new Error(`${label} 至少需要 ${route.minImages} 张参考图`);
    if (route.maxImages !== undefined && imageCount > route.maxImages) throw new Error(`${label} 最多支持 ${route.maxImages} 张参考图`);
    if (audioCount < route.minAudios) throw new Error(`${label} 至少需要 ${route.minAudios} 段参考音频`);
    if (route.maxAudios !== undefined && audioCount > route.maxAudios) throw new Error(`${label} 最多支持 ${route.maxAudios} 段参考音频`);
}

function readRoute(options?: Record<string, unknown>): H3Route | null {
    const raw = asObject(options?.canvasVideoRoute);
    if (!raw) return null;
    const family = stringValue(raw.family);
    const kind = stringValue(raw.kind) as H3RouteKind;
    if (family !== H3_FAMILY || !["auto", "text", "multi-reference", "first-last", "multi-reference-audio", "lip-sync"].includes(kind)) return null;
    const autodl = asObject(options?.autodl) || {};
    return {
        family,
        kind,
        minDuration: positiveNumber(raw.minDuration, 1),
        maxDuration: positiveNumber(raw.maxDuration, kind === "auto" ? 15 : 10),
        minImages: nonNegativeNumber(autodl.minReferenceImages, defaultImageMinimum(kind)),
        maxImages: optionalNonNegativeNumber(autodl.maxReferenceImages),
        minAudios: nonNegativeNumber(autodl.minReferenceAudios, defaultAudioMinimum(kind)),
        maxAudios: optionalNonNegativeNumber(autodl.maxReferenceAudios),
    };
}

function normalizeDuration(value: string) {
    const duration = Math.floor(Number(value));
    if (!Number.isFinite(duration) || duration < 1) throw new Error("MiniMax H3 视频时长必须是 1–15 秒整数");
    return duration;
}

function h3MissingRouteMessage(kind: Exclude<H3RouteKind, "auto">, duration: number) {
    const labels: Record<Exclude<H3RouteKind, "auto">, string> = {
        text: "文生视频",
        "multi-reference": "多图参考",
        "first-last": "首尾帧",
        "multi-reference-audio": "多图多音频",
        "lip-sync": "口型同步",
    };
    return `管理后台没有发布支持 ${duration} 秒的 MiniMax H3 ${labels[kind]}工作流`;
}

function defaultImageMinimum(kind: H3RouteKind) {
    return kind === "multi-reference" || kind === "multi-reference-audio" || kind === "lip-sync" ? 1 : kind === "first-last" ? 2 : 0;
}

function defaultAudioMinimum(kind: H3RouteKind) {
    return kind === "multi-reference-audio" || kind === "lip-sync" ? 1 : 0;
}

function asObject(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function stringValue(value: unknown) {
    return typeof value === "string" ? value : "";
}

function positiveNumber(value: unknown, fallback: number) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
}

function nonNegativeNumber(value: unknown, fallback: number) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function optionalNonNegativeNumber(value: unknown) {
    const number = Number(value);
    return value !== undefined && value !== null && Number.isFinite(number) && number >= 0 ? number : undefined;
}
