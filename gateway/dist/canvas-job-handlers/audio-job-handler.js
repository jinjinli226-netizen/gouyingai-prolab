import { createCapabilityJobHandler } from "./capability-job-handler.js";
export function createAudioJobHandler(runtime) {
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
//# sourceMappingURL=audio-job-handler.js.map