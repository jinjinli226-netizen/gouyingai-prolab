import { type CapabilityRouteRuntime } from "./capability-job-handler.js";
export type CanvasAudioJobResult = {
    url: string;
    storageKey: string;
    mimeType: string;
    bytes?: number;
    durationMs?: number;
};
export declare function createAudioJobHandler(runtime: CapabilityRouteRuntime<CanvasAudioJobResult>): import("../canvas-job-runner.js").CanvasJobHandler;
