import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
const emptyData = () => ({ channels: [], models: [], admins: [], usage: [], tasks: [], canvasJobs: [], canvasArtifacts: [], viralBatches: [], universalRemakeRuns: [] });
export class LocalStore {
    filePath;
    data;
    constructor(filePath) {
        this.filePath = filePath;
        if (existsSync(filePath)) {
            this.data = { ...emptyData(), ...JSON.parse(readFileSync(filePath, "utf8")) };
        }
        else {
            this.data = emptyData();
            this.save();
        }
    }
    save() {
        mkdirSync(dirname(this.filePath), { recursive: true });
        const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
        writeFileSync(temporaryPath, JSON.stringify(this.data, null, 2), "utf8");
        renameSync(temporaryPath, this.filePath);
    }
    listChannels() {
        return [...this.data.channels];
    }
    getChannel(id) {
        return this.data.channels.find((channel) => channel.id === id);
    }
    createChannel(input) {
        const channel = {
            id: randomUUID(),
            name: input.name,
            base_url: input.base_url,
            api_format: input.api_format,
            key_ciphertext: input.key_ciphertext,
            enabled: input.enabled,
        };
        this.data.channels.push(channel);
        this.save();
        return channel;
    }
    updateChannel(id, patch) {
        const index = this.data.channels.findIndex((channel) => channel.id === id);
        if (index < 0)
            return undefined;
        this.data.channels[index] = { ...this.data.channels[index], ...patch };
        this.save();
        return this.data.channels[index];
    }
    deleteChannel(id) {
        const before = this.data.channels.length;
        this.data.channels = this.data.channels.filter((channel) => channel.id !== id);
        this.data.models = this.data.models.filter((model) => model.channel_id !== id);
        this.save();
        return this.data.channels.length !== before;
    }
    listModels() {
        return [...this.data.models].sort((a, b) => a.sort_order - b.sort_order);
    }
    createModel(input) {
        const model = { ...input, id: randomUUID() };
        this.data.models.push(model);
        this.save();
        return model;
    }
    updateModel(id, patch) {
        const index = this.data.models.findIndex((model) => model.id === id);
        if (index < 0)
            return undefined;
        this.data.models[index] = { ...this.data.models[index], ...patch };
        this.save();
        return this.data.models[index];
    }
    deleteModel(id) {
        const before = this.data.models.length;
        this.data.models = this.data.models.filter((model) => model.id !== id);
        this.save();
        return this.data.models.length !== before;
    }
    listUsage(limit) {
        return [...this.data.usage].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
    }
    addUsage(record) {
        this.data.usage.push({ ...record, id: randomUUID(), created_at: new Date().toISOString() });
        if (this.data.usage.length > 5000)
            this.data.usage = this.data.usage.slice(-5000);
        this.save();
    }
    saveTask(task) {
        this.data.tasks = this.data.tasks.filter((item) => item.task_id !== task.task_id);
        this.data.tasks.push(task);
        this.save();
    }
    getTask(taskId) {
        return this.data.tasks.find((task) => task.task_id === taskId);
    }
    saveCanvasArtifact(userId, canvasId, input) {
        const id = randomUUID();
        const directory = join(dirname(this.filePath), "canvas-artifacts", id.slice(0, 2));
        mkdirSync(directory, { recursive: true });
        const filePath = join(directory, id);
        writeFileSync(filePath, input.bytes);
        const artifact = {
            id,
            user_id: userId,
            canvas_id: canvasId,
            uri: `canvas-artifact:local/${id}`,
            file_path: filePath,
            name: input.name,
            mime_type: input.mimeType,
            bytes: input.bytes.length,
            checksum: input.checksum,
            created_at: new Date().toISOString(),
        };
        this.data.canvasArtifacts.push(artifact);
        this.save();
        return artifact;
    }
    readCanvasArtifact(userId, canvasId, uri) {
        const artifact = this.data.canvasArtifacts.find((item) => item.uri === uri && item.user_id === userId && item.canvas_id === canvasId);
        if (!artifact || !existsSync(artifact.file_path))
            return undefined;
        return { ...artifact, bytes: readFileSync(artifact.file_path) };
    }
    createCanvasJob(userId, input) {
        const existing = this.data.canvasJobs.find((job) => job.user_id === userId && job.client_request_id === input.client_request_id);
        if (existing)
            return existing;
        const now = new Date().toISOString();
        const job = {
            id: randomUUID(),
            user_id: userId,
            canvas_id: input.canvas_id,
            parent_job_id: input.parent_job_id || null,
            batch_id: input.batch_id || null,
            candidate_index: input.candidate_index ?? null,
            target_node_id: input.target_node_id,
            generation_revision: input.generation_revision,
            client_request_id: input.client_request_id,
            kind: input.kind,
            status: "queued",
            model_id: input.model_id,
            channel_id: input.channel_id,
            input: input.input,
            upstream_task_id: null,
            result: null,
            result_patch: null,
            error: null,
            attempt: 0,
            max_attempts: input.max_attempts || 1,
            lease_owner: null,
            lease_expires_at: null,
            heartbeat_at: null,
            queued_at: now,
            started_at: null,
            finished_at: null,
            created_at: now,
            updated_at: now,
        };
        this.data.canvasJobs.push(job);
        this.save();
        return job;
    }
    getCanvasJob(userId, jobId) {
        return this.data.canvasJobs.find((job) => job.id === jobId && job.user_id === userId);
    }
    getCanvasJobInternal(jobId) {
        return this.data.canvasJobs.find((job) => job.id === jobId);
    }
    listCanvasJobs(userId, filters = {}) {
        return this.data.canvasJobs
            .filter((job) => job.user_id === userId && (!filters.canvasId || job.canvas_id === filters.canvasId) && (!filters.status || job.status === filters.status) && (!filters.batchId || job.batch_id === filters.batchId))
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    }
    updateCanvasJob(jobId, patch) {
        const index = this.data.canvasJobs.findIndex((job) => job.id === jobId);
        if (index < 0)
            return undefined;
        this.data.canvasJobs[index] = { ...this.data.canvasJobs[index], ...patch, id: this.data.canvasJobs[index].id, user_id: this.data.canvasJobs[index].user_id, updated_at: new Date().toISOString() };
        this.save();
        return this.data.canvasJobs[index];
    }
    claimCanvasJobs(workerId, limit, leaseSeconds, now = new Date()) {
        const nowMs = now.getTime();
        const leaseExpiresAt = new Date(nowMs + Math.max(5, leaseSeconds) * 1000).toISOString();
        let changed = false;
        for (const job of this.data.canvasJobs) {
            if (job.status === "cancel_requested" && Boolean(job.lease_expires_at) && Date.parse(job.lease_expires_at || "") < nowMs) {
                Object.assign(job, { status: "cancelled", finished_at: now.toISOString(), lease_owner: null, lease_expires_at: null, updated_at: now.toISOString() });
                changed = true;
            }
        }
        const candidates = this.data.canvasJobs
            .filter((job) => job.status === "queued" || (["leased", "submitting", "running"].includes(job.status) && Boolean(job.lease_expires_at) && Date.parse(job.lease_expires_at || "") < nowMs))
            .sort((a, b) => a.queued_at.localeCompare(b.queued_at))
            .slice(0, Math.max(0, limit));
        for (const candidate of candidates) {
            Object.assign(candidate, {
                status: "leased",
                lease_owner: workerId,
                lease_expires_at: leaseExpiresAt,
                heartbeat_at: now.toISOString(),
                started_at: candidate.started_at || now.toISOString(),
                attempt: candidate.attempt + 1,
                updated_at: now.toISOString(),
            });
        }
        if (candidates.length || changed)
            this.save();
        return candidates;
    }
    createViralBatch(userId, input) {
        const existing = this.data.viralBatches.find((batch) => batch.user_id === userId && batch.client_request_id === input.client_request_id);
        if (existing)
            return existing;
        const now = new Date().toISOString();
        const batch = {
            id: randomUUID(), user_id: userId, ...input, status: "queued", next_candidate_index: 0,
            queued_count: 0, running_count: 0, succeeded_count: 0, failed_count: 0, cancelled_count: 0,
            created_at: now, updated_at: now, finished_at: null,
        };
        this.data.viralBatches.push(batch);
        this.save();
        return batch;
    }
    getViralBatch(userId, batchId) {
        return this.data.viralBatches.find((batch) => batch.id === batchId && batch.user_id === userId);
    }
    getViralBatchInternal(batchId) {
        return this.data.viralBatches.find((batch) => batch.id === batchId);
    }
    listViralBatches(userId, canvasId) {
        return this.data.viralBatches.filter((batch) => batch.user_id === userId && (!canvasId || batch.canvas_id === canvasId)).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    }
    listActiveViralBatches() {
        return this.data.viralBatches.filter((batch) => batch.status === "queued" || batch.status === "running").sort((a, b) => a.created_at.localeCompare(b.created_at));
    }
    updateViralBatch(batchId, patch) {
        const index = this.data.viralBatches.findIndex((batch) => batch.id === batchId);
        if (index < 0)
            return undefined;
        this.data.viralBatches[index] = { ...this.data.viralBatches[index], ...patch, id: this.data.viralBatches[index].id, user_id: this.data.viralBatches[index].user_id, updated_at: new Date().toISOString() };
        this.save();
        return this.data.viralBatches[index];
    }
    createUniversalRemakeRun(userId, input) {
        const existing = this.data.universalRemakeRuns.find((run) => run.user_id === userId && run.client_request_id === input.client_request_id);
        if (existing)
            return existing;
        const now = new Date().toISOString();
        const run = {
            id: randomUUID(), user_id: userId, canvas_id: input.canvas_id, target_node_id: input.target_node_id,
            generation_revision: input.generation_revision, client_request_id: input.client_request_id, template_id: input.template_id,
            model_id: input.model_id, channel_id: input.channel_id, max_in_flight: input.max_in_flight, status: "queued",
            fidelity_model_id: input.fidelity_model_id || "", fidelity_channel_id: input.fidelity_channel_id || "",
            source_video_artifact_uri: input.source_video_artifact_uri || "", source_reference_asset_ids: input.source_reference_asset_ids || [],
            fidelity_contract: input.fidelity_contract || { schemaVersion: 3, durationSeconds: 0, aspectRatio: "9:16", canonicalPrompt: "", timelineUnits: [] },
            fidelity_threshold: input.fidelity_threshold ?? 85, max_fidelity_retries: input.max_fidelity_retries ?? 0,
            candidates: input.candidates.map((manifest, index) => ({
                index, manifest, status: "queued", segment_job_ids: [], segment_artifact_uris: [], continuation_frame_artifact_uris: [], output_artifact_uri: null,
                failure_stage: null, error: null, composition_attempt: 0, fidelity_status: "not-evaluated",
                generation_retry_count: 0, fidelity_job_id: null, fidelity_score: null, fidelity_attempt: 0,
                fidelity_issues: [], fidelity_matched_fact_ids: [], fidelity_missing_fact_ids: [], corrected_retry_prompt: null, updated_at: now,
            })),
            succeeded_count: 0, failed_count: 0, cancelled_count: 0, created_at: now, updated_at: now, finished_at: null,
        };
        this.data.universalRemakeRuns.push(run);
        this.save();
        return run;
    }
    getUniversalRemakeRun(userId, runId) {
        return this.data.universalRemakeRuns.find((run) => run.id === runId && run.user_id === userId);
    }
    getUniversalRemakeRunInternal(runId) {
        return this.data.universalRemakeRuns.find((run) => run.id === runId);
    }
    listUniversalRemakeRuns(userId, canvasId) {
        return this.data.universalRemakeRuns.filter((run) => run.user_id === userId && (!canvasId || run.canvas_id === canvasId)).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    }
    listActiveUniversalRemakeRuns() {
        return this.data.universalRemakeRuns.filter((run) => run.status === "queued" || run.status === "running").sort((a, b) => a.created_at.localeCompare(b.created_at));
    }
    updateUniversalRemakeRun(runId, patch) {
        const index = this.data.universalRemakeRuns.findIndex((run) => run.id === runId);
        if (index < 0)
            return undefined;
        const current = this.data.universalRemakeRuns[index];
        this.data.universalRemakeRuns[index] = { ...current, ...patch, id: current.id, user_id: current.user_id, updated_at: new Date().toISOString() };
        this.save();
        return this.data.universalRemakeRuns[index];
    }
    updateUniversalRemakeCandidate(runId, candidateIndex, patch) {
        const run = this.data.universalRemakeRuns.find((item) => item.id === runId);
        const candidate = run?.candidates.find((item) => item.index === candidateIndex);
        if (!run || !candidate)
            return undefined;
        Object.assign(candidate, patch, { index: candidate.index, updated_at: new Date().toISOString() });
        run.updated_at = new Date().toISOString();
        this.save();
        return run;
    }
}
//# sourceMappingURL=local-store.js.map