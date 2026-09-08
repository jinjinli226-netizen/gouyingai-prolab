import type { CanvasJobHandler } from "../canvas-job-runner.js";
import type { CanvasJobKind, Channel, Model } from "../types.js";
export type CapabilityRouteRuntime<TResult> = {
    loadModel: (modelId: string) => Promise<Model | null>;
    loadChannel: (channelId: string) => Promise<Channel | null>;
    generate: (input: {
        job: Parameters<CanvasJobHandler>[0]["job"];
        model: Model;
        channel: Channel;
        signal: AbortSignal;
    }) => Promise<TResult>;
    isGenerationCurrent?: (job: Parameters<CanvasJobHandler>[0]["job"]) => Promise<boolean>;
};
export declare function createCapabilityJobHandler<TResult extends Record<string, unknown>>(kind: Extract<CanvasJobKind, "text" | "image" | "audio">, runtime: CapabilityRouteRuntime<TResult>, nodeMetadata: (result: TResult) => Record<string, unknown>, acceptedKinds?: CanvasJobKind[]): CanvasJobHandler;
