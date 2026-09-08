import type { SupabaseClient } from "@supabase/supabase-js";
import type { LocalStore } from "../local-store.js";
import type { CanvasAudioJobResult } from "./audio-job-handler.js";
import type { CapabilityRouteRuntime } from "./capability-job-handler.js";
import type { CanvasImageJobResult } from "./image-job-handler.js";
import type { CanvasTextJobResult } from "./text-job-handler.js";
type RuntimeSet = {
    text: CapabilityRouteRuntime<CanvasTextJobResult>;
    image: CapabilityRouteRuntime<CanvasImageJobResult>;
    audio: CapabilityRouteRuntime<CanvasAudioJobResult>;
};
export declare function createLocalCapabilityRuntimes(store: LocalStore): RuntimeSet;
export declare function createSupabaseCapabilityRuntimes(admin: SupabaseClient): RuntimeSet;
export {};
