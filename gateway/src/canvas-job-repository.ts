import type { SupabaseClient } from "@supabase/supabase-js";

import { LocalStore } from "./local-store.js";
import type { CanvasJob, CanvasJobCreateInput, CanvasJobRepository, CanvasJobStatus } from "./types.js";

export function createLocalCanvasJobRepository(store: LocalStore): CanvasJobRepository {
    return {
        async create(userId, input) {
            return store.createCanvasJob(userId, input);
        },
        async get(userId, jobId) {
            return store.getCanvasJob(userId, jobId) || null;
        },
        async list(userId, filters) {
            return store.listCanvasJobs(userId, filters);
        },
        async update(jobId, patch) {
            return store.updateCanvasJob(jobId, patch) || null;
        },
        async claim(workerId, limit, leaseSeconds) {
            return store.claimCanvasJobs(workerId, limit, leaseSeconds);
        },
    };
}

export function createSupabaseCanvasJobRepository(admin: SupabaseClient): CanvasJobRepository {
    return {
        async create(userId: string, input: CanvasJobCreateInput) {
            const existing = await findByClientRequest(admin, userId, input.client_request_id);
            if (existing) return existing;

            await ensureCanvasProject(admin, userId, input.canvas_id);
            const { data, error } = await admin.from("gouyingai_canvas_jobs").insert({
                ...input,
                user_id: userId,
                parent_job_id: input.parent_job_id || null,
                batch_id: input.batch_id || null,
                candidate_index: input.candidate_index ?? null,
                max_attempts: input.max_attempts || 1,
            }).select("*").single();
            if (!error && data) return data as CanvasJob;
            if (error?.code === "23505") {
                const duplicate = await findByClientRequest(admin, userId, input.client_request_id);
                if (duplicate) return duplicate;
            }
            throw new Error(error?.message || "创建画布任务失败");
        },
        async get(userId: string, jobId: string) {
            const { data, error } = await admin.from("gouyingai_canvas_jobs").select("*").eq("user_id", userId).eq("id", jobId).maybeSingle();
            if (error) throw new Error(error.message);
            return (data as CanvasJob | null) || null;
        },
        async list(userId: string, filters: { canvasId?: string; status?: CanvasJobStatus; batchId?: string } = {}) {
            let query = admin.from("gouyingai_canvas_jobs").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
            if (filters.canvasId) query = query.eq("canvas_id", filters.canvasId);
            if (filters.status) query = query.eq("status", filters.status);
            if (filters.batchId) query = query.eq("batch_id", filters.batchId);
            const { data, error } = await query;
            if (error) throw new Error(error.message);
            return (data || []) as CanvasJob[];
        },
        async update(jobId: string, patch: Partial<CanvasJob>) {
            const { id: _id, user_id: _userId, created_at: _createdAt, ...mutable } = patch;
            const { data, error } = await admin.from("gouyingai_canvas_jobs").update({ ...mutable, updated_at: new Date().toISOString() }).eq("id", jobId).select("*").maybeSingle();
            if (error) throw new Error(error.message);
            return (data as CanvasJob | null) || null;
        },
        async claim(workerId: string, limit: number, leaseSeconds: number) {
            const { data, error } = await admin.rpc("claim_gouyingai_canvas_jobs", {
                p_worker_id: workerId,
                p_limit: limit,
                p_lease_seconds: leaseSeconds,
            });
            if (error) throw new Error(error.message);
            return (data || []) as CanvasJob[];
        },
    };
}

async function findByClientRequest(admin: SupabaseClient, userId: string, clientRequestId: string) {
    const { data, error } = await admin.from("gouyingai_canvas_jobs").select("*").eq("user_id", userId).eq("client_request_id", clientRequestId).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as CanvasJob | null) || null;
}

async function ensureCanvasProject(admin: SupabaseClient, userId: string, canvasId: string) {
    const { data, error } = await admin.from("gouyingai_canvas_projects").select("id").eq("user_id", userId).eq("id", canvasId).maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return;
    const created = await admin.from("gouyingai_canvas_projects").insert({ user_id: userId, id: canvasId, payload: { id: canvasId } });
    if (created.error && created.error.code !== "23505") throw new Error(created.error.message);
}
