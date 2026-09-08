import type { SupabaseClient } from "@supabase/supabase-js";
import { LocalStore } from "./local-store.js";
import type { ViralBatchRepository } from "./types.js";
export declare function createLocalViralBatchRepository(store: LocalStore): ViralBatchRepository;
export declare function createSupabaseViralBatchRepository(admin: SupabaseClient): ViralBatchRepository;
