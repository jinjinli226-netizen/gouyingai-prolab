import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { isSupabaseConfigReady } from "@/lib/cloud-sync-utils";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = isSupabaseConfigReady(supabaseUrl, supabaseAnonKey);
export const supabase: SupabaseClient | null = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;

export const SUPABASE_MEDIA_BUCKET = "gouyingai-media";

export function requireSupabase() {
    if (!supabase) throw new Error("尚未配置 Supabase，请先设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY");
    return supabase;
}
