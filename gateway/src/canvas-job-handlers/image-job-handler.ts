import { createCapabilityJobHandler, type CapabilityRouteRuntime } from "./capability-job-handler.js";

export type CanvasImageJobResult = {
    url: string;
    storageKey: string;
    mimeType: string;
    bytes?: number;
    width?: number;
    height?: number;
};

export function createImageJobHandler(runtime: CapabilityRouteRuntime<CanvasImageJobResult>) {
    return createCapabilityJobHandler("image", runtime, (result) => ({
        content: result.url,
        storageKey: result.storageKey,
        mimeType: result.mimeType,
        bytes: result.bytes,
        naturalWidth: result.width,
        naturalHeight: result.height,
        status: "success",
        errorDetails: undefined,
    }));
}
