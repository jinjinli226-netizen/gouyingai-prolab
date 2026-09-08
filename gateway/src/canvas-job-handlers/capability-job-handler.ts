import type { CanvasJobHandler } from "../canvas-job-runner.js";
import type { CanvasJobKind, Channel, Model } from "../types.js";

export type CapabilityRouteRuntime<TResult> = {
    loadModel: (modelId: string) => Promise<Model | null>;
    loadChannel: (channelId: string) => Promise<Channel | null>;
    generate: (input: { job: Parameters<CanvasJobHandler>[0]["job"]; model: Model; channel: Channel; signal: AbortSignal }) => Promise<TResult>;
    isGenerationCurrent?: (job: Parameters<CanvasJobHandler>[0]["job"]) => Promise<boolean>;
};

export function createCapabilityJobHandler<TResult extends Record<string, unknown>>(
    kind: Extract<CanvasJobKind, "text" | "image" | "audio">,
    runtime: CapabilityRouteRuntime<TResult>,
    nodeMetadata: (result: TResult) => Record<string, unknown>,
    acceptedKinds: CanvasJobKind[] = [kind],
): CanvasJobHandler {
    return async ({ job, signal }) => {
        if (!acceptedKinds.includes(job.kind)) throw new Error(`任务 ${job.id} 不是 ${acceptedKinds.join("/")} 任务`);
        if (!job.model_id || !job.channel_id) throw new Error(`${kind} 任务缺少固定的模型或渠道绑定`);
        const [model, channel] = await Promise.all([runtime.loadModel(job.model_id), runtime.loadChannel(job.channel_id)]);
        if (!model || !channel || model.capability !== kind || !model.published || !channel.enabled || model.channel_id !== channel.id) {
            throw new Error(`${kind} 任务的模型/渠道路由绑定已失效`);
        }
        const generated = await runtime.generate({ job, model, channel, signal });
        const mounted = runtime.isGenerationCurrent ? await runtime.isGenerationCurrent(job) : true;
        return {
            result: { ...generated, mounted },
            result_patch: mounted
                ? {
                      canvasId: job.canvas_id,
                      nodeId: job.target_node_id,
                      jobId: job.id,
                      generationRevision: job.generation_revision,
                      nodePatch: { metadata: nodeMetadata(generated) },
                  }
                : null,
        };
    };
}
