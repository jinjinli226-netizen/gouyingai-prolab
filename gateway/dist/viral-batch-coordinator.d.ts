import type { CanvasJobRepository, ViralBatchRepository } from "./types.js";
export declare function materializeViralBatchWindow(batchId: string, batches: ViralBatchRepository, jobs: CanvasJobRepository): Promise<import("./types.js").ViralBatch | null>;
export declare function reconcileViralBatch(batchId: string, batches: ViralBatchRepository, jobs: CanvasJobRepository): Promise<import("./types.js").ViralBatch | null>;
export declare class ViralBatchCoordinator {
    private batches;
    private jobs;
    private intervalMs;
    private timer;
    constructor(batches: ViralBatchRepository, jobs: CanvasJobRepository, intervalMs?: number);
    start(): void;
    stop(): void;
    runOnce(): Promise<void>;
}
