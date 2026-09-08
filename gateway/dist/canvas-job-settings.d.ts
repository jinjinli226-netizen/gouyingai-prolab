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
export declare function loadCanvasJobRunnerSettings(environment?: NodeJS.ProcessEnv): CanvasJobRunnerSettings;
