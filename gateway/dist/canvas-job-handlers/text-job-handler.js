import { createCapabilityJobHandler } from "./capability-job-handler.js";
export function createTextJobHandler(runtime) {
    return createCapabilityJobHandler("text", runtime, (result) => ({ content: result.text, status: "success", errorDetails: undefined }));
}
export function createViralTextJobHandler(runtime, kind) {
    return createCapabilityJobHandler("text", runtime, (result) => ({ content: result.text, status: "success", errorDetails: undefined }), [kind]);
}
//# sourceMappingURL=text-job-handler.js.map