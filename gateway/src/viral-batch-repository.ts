import type { SupabaseClient } from "@supabase/supabase-js";

import { LocalStore } from "./local-store.js";
import type { ViralBatch, ViralBatchCreateInput, ViralBatchRepository } from "./types.js";

export function createLocalViralBatchRepository(store: LocalStore): ViralBatchRepository {
    return {
        async create(userId, input) { return store.createViralBatch(userId, input); },
        async get(userId, batchId) { return store.getViralBatch(userId, batchId) || null; },
        async getInternal(batchId) { return store.getViralBatchInternal(batchId) || null; },
        async list(userId, canvasId) { return store.listViralBatches(userId, canvasId); },
        async listActive() { return store.listActiveViralBatches(); },
        async update(batchId, patch) { return store.updateViralBatch(batchId, patch) || null; },
    };
}

export function createSupabaseViralBatchRepository(admin: SupabaseClient): ViralBatchRepository {
    return {
        async create(userId: string, input: ViralBatchCreateInput) {
            const existing = await findByClientRequest(admin, userId, input.client_request_id);
            if (existing) return existing;
            const { data, error } = await admin.from("gouyingai_viral_batches").insert({ ...input, user_id: userId }).select("*").single();
            if (!error && data) return data as ViralBatch;
            if (error?.code === "23505") {
                const duplicate = await findByClientRequest(admin, userId, input.client_request_id);
                if (duplicate) return duplicate;
            }
            throw new Error(error?.message || "创建爆款复刻批次失败");
        },
        async get(userId, batchId) {
            const { data, error } = await admin.from("gouyingai_viral_batches").select("*").eq("user_id", userId).eq("id", batchId).maybeSingle();
            if (error) throw new Error(error.message);
            return (data as ViralBatch | null) || null;
        },
        async getInternal(batchId) {
            const { data, error } = await admin.from("gouyingai_viral_batches").select("*").eq("id", batchId).maybeSingle();
            if (error) throw new Error(error.message);
            return (data as ViralBatch | null) || null;
        },
        async list(userId, canvasId) {
            let query = admin.from("gouyingai_viral_batches").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
            if (canvasId) query = query.eq("canvas_id", canvasId);
            const { data, error } = await query;
            if (error) throw new Error(error.message);
            return (data || []) as ViralBatch[];
        },
        async listActive() {
            const { data, error } = await admin.from("gouyingai_viral_batches").select("*").in("status", ["queued", "running"]).order("created_at", { ascending: true });
            if (error) throw new Error(error.message);
            return (data || []) as ViralBatch[];
        },
        async update(batchId, patch) {
            const { id: _id, user_id: _userId, created_at: _createdAt, ...mutable } = patch;
            const { data, error } = await admin.from("gouyingai_viral_batches").update({ ...mutable, updated_at: new Date().toISOString() }).eq("id", batchId).select("*").maybeSingle();
            if (error) throw new Error(error.message);
            return (data as ViralBatch | null) || null;
        },
    };
}

async function findByClientRequest(admin: SupabaseClient, userId: string, clientRequestId: string) {
    const { data, error } = await admin.from("gouyingai_viral_batches").select("*").eq("user_id", userId).eq("client_request_id", clientRequestId).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as ViralBatch | null) || null;
}
