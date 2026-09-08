import type { CanvasJobRepository } from "../types.js";
import type { UniversalRemakeRun, UniversalRemakeRunRepository, UniversalRunCandidate } from "./types.js";
export type UniversalCompositionPort = {
    compose(run: UniversalRemakeRun, candidate: UniversalRunCandidate, segmentArtifactUris: string[]): Promise<{
        artifactUri: string;
    }>;
    extractContinuationFrame(run: UniversalRemakeRun, candidate: UniversalRunCandidate, segmentArtifactUri: string): Promise<{
        artifactUri: string;
    }>;
};
export declare class UniversalRemakeCoordinator {
    private runs;
    private jobs;
    private composition;
    private intervalMs;
    private timer;
    private reconciliations;
    constructor(runs: UniversalRemakeRunRepository, jobs: CanvasJobRepository, composition: UniversalCompositionPort, intervalMs?: number);
    start(): void;
    stop(): void;
    runOnce(): Promise<void>;
    reconcile(runId: string): Promise<UniversalRemakeRun | null>;
    private reconcileUnlocked;
    retryComposition(runId: string, candidateIndex: number): Promise<void>;
    pause(runId: string): Promise<UniversalRemakeRun | null>;
    resume(runId: string): Promise<UniversalRemakeRun | null>;
    cancel(runId: string): Promise<UniversalRemakeRun | null>;
    private advanceCandidate;
    private createSegmentJob;
    private failSegment;
    private finishOrCompose;
    private compose;
    private refreshRun;
}
