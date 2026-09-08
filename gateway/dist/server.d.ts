import { type SupabaseClient } from "@supabase/supabase-js";
import type { GatewayTask } from "./types.js";
export type GatewayContext = {
    auth: SupabaseClient;
    admin: SupabaseClient;
    memoryTasks: Map<string, GatewayTask>;
};
export declare function createGatewayApp(context: GatewayContext): import("express-serve-static-core").Express;
