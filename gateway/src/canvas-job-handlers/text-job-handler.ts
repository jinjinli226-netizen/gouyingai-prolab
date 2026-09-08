import { createCapabilityJobHandler, type CapabilityRouteRuntime } from "./capability-job-handler.js";
import type { CanvasJobKind } from "../types.js";

export type CanvasTextJobResult = { text: string };

export function createTextJobHandler(runtime: CapabilityRouteRuntime<CanvasTextJobResult>) {
    return createCapabilityJobHandler("text", runtime, (result) => ({ content: result.text, status: "success", errorDetails: undefined }));
}

export function createViralTextJobHandler(runtime: CapabilityRouteRuntime<CanvasTextJobResult>, kind: Extract<CanvasJobKind, "viral-analysis" | "viral-plan">) {
    return createCapabilityJobHandler("text", runtime, (result) => ({ content: result.text, status: "success", errorDetails: undefined }), [kind]);
}
