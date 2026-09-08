import type { LocalStore } from "../local-store.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UniversalRemakeRunRepository } from "./types.js";
export declare function createLocalUniversalRemakeRepository(store: LocalStore): UniversalRemakeRunRepository;
export declare function createSupabaseUniversalRemakeRepository(admin: SupabaseClient): UniversalRemakeRunRepository;
