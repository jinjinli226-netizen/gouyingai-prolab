import type { SupabaseClient } from "@supabase/supabase-js";
import type { LocalStore } from "../local-store.js";
import type { UniversalCompositionPort } from "./coordinator.js";
export declare function createLocalUniversalCompositionPort(store: LocalStore): UniversalCompositionPort;
export declare function createSupabaseUniversalCompositionPort(admin: SupabaseClient): UniversalCompositionPort;
