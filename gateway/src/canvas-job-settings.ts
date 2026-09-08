import type { CanvasJobKind } from "./types.js";

export type CanvasJobRunnerSettings = {
    globalConcurrency: number;
    capabilityConcurrency: Partial<Record<CanvasJobKind, number>>;
    channelConcurrency: Record<string, number>;
    leaseSeconds: number;
    heartbeatIntervalMs: number;
    pollIntervalMs: number;
    claimBatch: number;
};

export function loadCanvasJobRunnerSettings(environment: NodeJS.ProcessEnv = process.env): CanvasJobRunnerSettings {
    const globalConcurrency = positiveInteger(environment.CANVAS_JOB_CONCURRENCY_GLOBAL, 4);
    return {
        globalConcurrency,
        capabilityConcurrency: {
            text: positiveIntegerOrUndefined(environment.CANVAS_JOB_CONCURRENCY_TEXT),
            image: positiveIntegerOrUndefined(environment.CANVAS_JOB_CONCURRENCY_IMAGE),
            video: positiveIntegerOrUndefined(environment.CANVAS_JOB_CONCURRENCY_VIDEO),
            audio: positiveIntegerOrUndefined(environment.CANVAS_JOB_CONCURRENCY_AUDIO),
            "viral-analysis": positiveIntegerOrUndefined(environment.CANVAS_JOB_CONCURRENCY_VIRAL_ANALYSIS),
            "viral-plan": positiveIntegerOrUndefined(environment.CANVAS_JOB_CONCURRENCY_VIRAL_PLAN),
            "viral-video": positiveIntegerOrUndefined(environment.CANVAS_JOB_CONCURRENCY_VIRAL_VIDEO),
            "viral-quality": positiveIntegerOrUndefined(environment.CANVAS_JOB_CONCURRENCY_VIRAL_QUALITY),
        },
        channelConcurrency: parseLimitMap(environment.CANVAS_JOB_CHANNEL_LIMITS),
        leaseSeconds: positiveInteger(environment.CANVAS_JOB_LEASE_SECONDS, 60),
        heartbeatIntervalMs: positiveInteger(environment.CANVAS_JOB_HEARTBEAT_MS, 15_000),
        pollIntervalMs: positiveInteger(environment.CANVAS_JOB_POLL_MS, 1_000),
        claimBatch: positiveInteger(environment.CANVAS_JOB_CLAIM_BATCH, Math.max(16, globalConcurrency * 4)),
    };
}

function positiveInteger(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function positiveIntegerOrUndefined(value: string | undefined) {
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseLimitMap(value: string | undefined) {
    if (!value) return {};
    try {
        const parsed = JSON.parse(value) as Record<string, unknown>;
        return Object.fromEntries(Object.entries(parsed).flatMap(([key, raw]) => {
            const limit = Number(raw);
            return key && Number.isInteger(limit) && limit > 0 ? [[key, limit]] : [];
        }));
    } catch {
        return {};
    }
}
