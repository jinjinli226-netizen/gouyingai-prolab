type JsonObject = Record<string, unknown>;
export type AutoDlVideoInput = {
    prompt: string;
    duration: string;
    resolution: string;
    size: string;
    referenceImages: string[];
    referenceAudios: string[];
};
export type AutoDlNormalizedTask = {
    upstreamTaskId?: string;
    status: "queued" | "in_progress" | "completed" | "failed";
    resultUrl?: string;
    error?: string;
};
export declare function buildAutoDlWorkflowRequest(options: JsonObject, input: AutoDlVideoInput): {
    workflowId: string;
    body: JsonObject;
};
export declare function normalizeAutoDlTask(payload: unknown): AutoDlNormalizedTask;
export declare function parseUnifiedVideoInput(raw: Buffer, contentType: string): Promise<{
    model: string;
} & AutoDlVideoInput>;
export declare function autoDlCreateUrl(baseUrl: string, workflowId: string): string;
export declare function autoDlResultUrl(baseUrl: string, taskId: string): string;
export declare function submitAutoDlWorkflow(baseUrl: string, token: string, workflow: {
    workflowId: string;
    body: JsonObject;
}): Promise<{
    response: Response;
    task: AutoDlNormalizedTask;
}>;
export declare function queryAutoDlWorkflow(baseUrl: string, token: string, taskId: string): Promise<{
    response: Response;
    task: AutoDlNormalizedTask;
}>;
export {};
