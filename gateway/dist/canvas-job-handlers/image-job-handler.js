import { createCapabilityJobHandler } from "./capability-job-handler.js";
export function createImageJobHandler(runtime) {
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
//# sourceMappingURL=image-job-handler.js.map