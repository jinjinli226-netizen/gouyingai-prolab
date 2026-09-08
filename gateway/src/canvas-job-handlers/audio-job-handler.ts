import { createCapabilityJobHandler, type CapabilityRouteRuntime } from "./capability-job-handler.js";

export type CanvasAudioJobResult = {
    url: string;
    storageKey: string;
    mimeType: string;
    bytes?: number;
    durationMs?: number;
};

export function createAudioJobHandler(runtime: CapabilityRouteRuntime<CanvasAudioJobResult>) {
    return createCapabilityJobHandler("audio", runtime, (result) => ({
        content: result.url,
        storageKey: result.storageKey,
        mimeType: result.mimeType,
        bytes: result.bytes,
        durationMs: result.durationMs,
        status: "success",
        errorDetails: undefined,
    }));
}
