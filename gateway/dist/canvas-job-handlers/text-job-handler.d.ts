import { type CapabilityRouteRuntime } from "./capability-job-handler.js";
import type { CanvasJobKind } from "../types.js";
export type CanvasTextJobResult = {
    text: string;
};
export declare function createTextJobHandler(runtime: CapabilityRouteRuntime<CanvasTextJobResult>): import("../canvas-job-runner.js").CanvasJobHandler;
export declare function createViralTextJobHandler(runtime: CapabilityRouteRuntime<CanvasTextJobResult>, kind: Extract<CanvasJobKind, "viral-analysis" | "viral-plan">): import("../canvas-job-runner.js").CanvasJobHandler;
