export function createLocalCanvasJobRepository(store) {
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
export function createSupabaseCanvasJobRepository(admin) {
    return {
        async create(userId, input) {
            const existing = await findByClientRequest(admin, userId, input.client_request_id);
            if (existing)
                return existing;
            await ensureCanvasProject(admin, userId, input.canvas_id);
            const { data, error } = await admin.from("gouyingai_canvas_jobs").insert({
                ...input,
                user_id: userId,
                parent_job_id: input.parent_job_id || null,
                batch_id: input.batch_id || null,
                candidate_index: input.candidate_index ?? null,
                max_attempts: input.max_attempts || 1,
            }).select("*").single();
            if (!error && data)
                return data;
            if (error?.code === "23505") {
                const duplicate = await findByClientRequest(admin, userId, input.client_request_id);
                if (duplicate)
                    return duplicate;
            }
            throw new Error(error?.message || "创建画布任务失败");
        },
        async get(userId, jobId) {
            const { data, error } = await admin.from("gouyingai_canvas_jobs").select("*").eq("user_id", userId).eq("id", jobId).maybeSingle();
            if (error)
                throw new Error(error.message);
            return data || null;
        },
        async list(userId, filters = {}) {
            let query = admin.from("gouyingai_canvas_jobs").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
            if (filters.canvasId)
                query = query.eq("canvas_id", filters.canvasId);
            if (filters.status)
                query = query.eq("status", filters.status);
            if (filters.batchId)
                query = query.eq("batch_id", filters.batchId);
            const { data, error } = await query;
            if (error)
                throw new Error(error.message);
            return (data || []);
        },
        async update(jobId, patch) {
            const { id: _id, user_id: _userId, created_at: _createdAt, ...mutable } = patch;
            const { data, error } = await admin.from("gouyingai_canvas_jobs").update({ ...mutable, updated_at: new Date().toISOString() }).eq("id", jobId).select("*").maybeSingle();
            if (error)
                throw new Error(error.message);
            return data || null;
        },
        async claim(workerId, limit, leaseSeconds) {
            const { data, error } = await admin.rpc("claim_gouyingai_canvas_jobs", {
                p_worker_id: workerId,
                p_limit: limit,
                p_lease_seconds: leaseSeconds,
            });
            if (error)
                throw new Error(error.message);
            return (data || []);
        },
    };
}
async function findByClientRequest(admin, userId, clientRequestId) {
    const { data, error } = await admin.from("gouyingai_canvas_jobs").select("*").eq("user_id", userId).eq("client_request_id", clientRequestId).maybeSingle();
    if (error)
        throw new Error(error.message);
    return data || null;
}
async function ensureCanvasProject(admin, userId, canvasId) {
    const { data, error } = await admin.from("gouyingai_canvas_projects").select("id").eq("user_id", userId).eq("id", canvasId).maybeSingle();
    if (error)
        throw new Error(error.message);
    if (data)
        return;
    const created = await admin.from("gouyingai_canvas_projects").insert({ user_id: userId, id: canvasId, payload: { id: canvasId } });
    if (created.error && created.error.code !== "23505")
        throw new Error(created.error.message);
}
//# sourceMappingURL=canvas-job-repository.js.map