import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanvasJobHandler } from "../canvas-job-runner.js";
import type { LocalStore } from "../local-store.js";
import type { Channel, Model } from "../types.js";
export type CanvasVideoResult = {
    url: string;
    mimeType?: string;
    storageKey?: string;
};
export type CanvasVideoUpstreamState = {
    status: "pending";
    upstreamTaskId?: string;
} | {
    status: "completed";
    upstreamTaskId?: string;
    result: CanvasVideoResult;
} | {
    status: "failed";
    upstreamTaskId?: string;
    error: string;
};
export type CanvasVideoJobRuntime = {
    loadModel: (modelId: string) => Promise<Model | null>;
    loadChannel: (channelId: string) => Promise<Channel | null>;
    submit: (input: {
        job: Parameters<CanvasJobHandler>[0]["job"];
        model: Model;
        channel: Channel;
    }) => Promise<CanvasVideoUpstreamState>;
    poll: (input: {
        job: Parameters<CanvasJobHandler>[0]["job"];
        model: Model;
        channel: Channel;
        upstreamTaskId: string;
    }) => Promise<CanvasVideoUpstreamState>;
    sleep?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
    pollIntervalMs?: number;
    maxPollAttempts?: number;
    isGenerationCurrent?: (job: Parameters<CanvasJobHandler>[0]["job"]) => Promise<boolean>;
    saveResult?: (input: {
        job: Parameters<CanvasJobHandler>[0]["job"];
        channel: Channel;
        result: CanvasVideoResult;
        signal: AbortSignal;
    }) => Promise<CanvasVideoResult>;
};
export declare function createVideoJobHandler(runtime: CanvasVideoJobRuntime): CanvasJobHandler;
export declare function createLocalVideoJobRuntime(store: LocalStore, overrides?: Partial<CanvasVideoJobRuntime>): CanvasVideoJobRuntime;
export declare function createSupabaseVideoJobRuntime(admin: SupabaseClient, overrides?: Partial<CanvasVideoJobRuntime>): CanvasVideoJobRuntime;
