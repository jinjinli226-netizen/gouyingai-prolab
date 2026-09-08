import type { CanvasJobRunnerSettings } from "./canvas-job-settings.js";
import type { CanvasJob, CanvasJobRepository } from "./types.js";
export type CanvasJobHandlerContext = {
    job: CanvasJob;
    signal: AbortSignal;
    update: (patch: Partial<CanvasJob>) => Promise<CanvasJob>;
};
export type CanvasJobHandler = (context: CanvasJobHandlerContext) => Promise<Partial<CanvasJob> | void>;
export type CanvasJobRunnerOptions = {
    repository: CanvasJobRepository;
    handler: CanvasJobHandler;
    settings: CanvasJobRunnerSettings;
    workerId?: string;
};
export declare class CanvasJobRunner {
    private readonly repository;
    private readonly handler;
    private readonly settings;
    private readonly workerId;
    private readonly active;
    private pollTimer;
    private stopped;
    private claiming;
    constructor(options: CanvasJobRunnerOptions);
    get activeCount(): number;
    start(): void;
    stop(): void;
    runOnce(): Promise<void>;
    waitForIdle(): Promise<void>;
    private selectCandidates;
    private withinLimits;
    private releaseClaim;
    private startJob;
}
