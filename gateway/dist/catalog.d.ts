import type { Channel, Model, PublicModel } from "./types.js";
export declare const MODEL_CAPABILITY_HEADER = "x-gouyingai-capability";
export declare function normalizeProviderBaseUrl(baseUrl: string): string;
export declare function buildUpstreamUrl(baseUrl: string, providerPath: string): string;
export declare function toPublicModel(model: Model, channel?: Channel): PublicModel;
export declare function pickModelByName(models: Model[], name: string): Model | undefined;
/** A duplicate public name has no stable upstream target, so it must never be routed. */
export declare function unambiguousPublishedModels<T extends Pick<Model, "model_name" | "published">>(models: T[]): T[];
export declare function parseModelCapability(value: unknown): Model["capability"] | undefined;
export declare function pickChannelById(channels: Channel[], id: string): Channel | undefined;
export declare function extractModelNameFromJson(body: string): string;
export declare function extractModelNameFromMultipart(body: Buffer): string;
