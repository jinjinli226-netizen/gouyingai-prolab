export function createLocalUniversalRemakeRepository(store) {
    return {
        create: async (userId, input) => store.createUniversalRemakeRun(userId, input),
        get: async (userId, runId) => store.getUniversalRemakeRun(userId, runId) ?? null,
        getInternal: async (runId) => store.getUniversalRemakeRunInternal(runId) ?? null,
        list: async (userId, canvasId) => store.listUniversalRemakeRuns(userId, canvasId),
        listActive: async () => store.listActiveUniversalRemakeRuns(),
        update: async (runId, patch) => store.updateUniversalRemakeRun(runId, patch) ?? null,
        updateCandidate: async (runId, candidateIndex, patch) => store.updateUniversalRemakeCandidate(runId, candidateIndex, patch) ?? null,
    };
}
export function createSupabaseUniversalRemakeRepository(admin) {
    return {
        async create(userId, input) {
            const existing = await findByClientRequest(admin, userId, input.client_request_id);
            if (existing)
                return existing;
            const now = new Date().toISOString();
            const candidates = input.candidates.map((manifest, index) => ({
                index, manifest, status: "queued", segment_job_ids: [], segment_artifact_uris: [], continuation_frame_artifact_uris: [], output_artifact_uri: null,
                failure_stage: null, error: null, composition_attempt: 0, fidelity_status: "not-evaluated",
                generation_retry_count: 0, fidelity_job_id: null, fidelity_score: null, fidelity_attempt: 0,
                fidelity_issues: [], fidelity_matched_fact_ids: [], fidelity_missing_fact_ids: [], corrected_retry_prompt: null, updated_at: now,
            }));
            const { data, error } = await admin.from("gouyingai_universal_remake_runs").insert({
                ...input,
                fidelity_model_id: input.fidelity_model_id || "", fidelity_channel_id: input.fidelity_channel_id || "",
                source_video_artifact_uri: input.source_video_artifact_uri || "", source_reference_asset_ids: input.source_reference_asset_ids || [],
                fidelity_contract: input.fidelity_contract || { schemaVersion: 3, durationSeconds: 0, aspectRatio: "9:16", canonicalPrompt: "", timelineUnits: [] },
                fidelity_threshold: input.fidelity_threshold ?? 85, max_fidelity_retries: input.max_fidelity_retries ?? 0,
                candidates, user_id: userId, status: "queued", succeeded_count: 0, failed_count: 0, cancelled_count: 0,
            }).select("*").single();
            if (!error && data)
                return data;
            if (error?.code === "23505") {
                const duplicate = await findByClientRequest(admin, userId, input.client_request_id);
                if (duplicate)
                    return duplicate;
            }
            throw new Error(error?.message || "创建通用复刻运行失败");
        },
        async get(userId, runId) {
            const { data, error } = await admin.from("gouyingai_universal_remake_runs").select("*").eq("user_id", userId).eq("id", runId).maybeSingle();
            if (error)
                throw new Error(error.message);
            return data || null;
        },
        async getInternal(runId) {
            const { data, error } = await admin.from("gouyingai_universal_remake_runs").select("*").eq("id", runId).maybeSingle();
            if (error)
                throw new Error(error.message);
            return data || null;
        },
        async list(userId, canvasId) {
            let query = admin.from("gouyingai_universal_remake_runs").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
            if (canvasId)
                query = query.eq("canvas_id", canvasId);
            const { data, error } = await query;
            if (error)
                throw new Error(error.message);
            return (data || []);
        },
        async listActive() {
            const [queued, running] = await Promise.all([
                admin.from("gouyingai_universal_remake_runs").select("*").eq("status", "queued").order("created_at", { ascending: true }),
                admin.from("gouyingai_universal_remake_runs").select("*").eq("status", "running").order("created_at", { ascending: true }),
            ]);
            if (queued.error || running.error)
                throw new Error(queued.error?.message || running.error?.message);
            return [...(queued.data || []), ...(running.data || [])].sort((left, right) => left.created_at.localeCompare(right.created_at));
        },
        async update(runId, patch) {
            const { id: _id, user_id: _userId, created_at: _createdAt, ...mutable } = patch;
            const { data, error } = await admin.from("gouyingai_universal_remake_runs").update({ ...mutable, updated_at: new Date().toISOString() }).eq("id", runId).select("*").maybeSingle();
            if (error)
                throw new Error(error.message);
            return data || null;
        },
        async updateCandidate(runId, candidateIndex, patch) {
            const { data: current, error: readError } = await admin.from("gouyingai_universal_remake_runs").select("*").eq("id", runId).maybeSingle();
            if (readError)
                throw new Error(readError.message);
            if (!current)
                return null;
            const run = current;
            const candidates = run.candidates.map((candidate) => candidate.index === candidateIndex
                ? { ...candidate, ...patch, index: candidate.index, updated_at: new Date().toISOString() }
                : candidate);
            const { data, error } = await admin.from("gouyingai_universal_remake_runs").update({ candidates, updated_at: new Date().toISOString() }).eq("id", runId).select("*").maybeSingle();
            if (error)
                throw new Error(error.message);
            return data || null;
        },
    };
}
async function findByClientRequest(admin, userId, clientRequestId) {
    const { data, error } = await admin.from("gouyingai_universal_remake_runs").select("*").eq("user_id", userId).eq("client_request_id", clientRequestId).maybeSingle();
    if (error)
        throw new Error(error.message);
    return data || null;
}
//# sourceMappingURL=repository.js.map