import { type CapabilityRouteRuntime } from "./capability-job-handler.js";
export type CanvasImageJobResult = {
    url: string;
    storageKey: string;
    mimeType: string;
    bytes?: number;
    width?: number;
    height?: number;
};
export declare function createImageJobHandler(runtime: CapabilityRouteRuntime<CanvasImageJobResult>): import("../canvas-job-runner.js").CanvasJobHandler;
