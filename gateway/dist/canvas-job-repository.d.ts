import type { SupabaseClient } from "@supabase/supabase-js";
import { LocalStore } from "./local-store.js";
import type { CanvasJobRepository } from "./types.js";
export declare function createLocalCanvasJobRepository(store: LocalStore): CanvasJobRepository;
export declare function createSupabaseCanvasJobRepository(admin: SupabaseClient): CanvasJobRepository;
