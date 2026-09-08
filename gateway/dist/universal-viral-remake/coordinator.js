const activeJobStatuses = new Set(["queued", "leased", "submitting", "running", "cancel_requested"]);
export class UniversalRemakeCoordinator {
    runs;
    jobs;
    composition;
    intervalMs;
    timer = null;
    reconciliations = new Map();
    constructor(runs, jobs, composition, intervalMs = 1000) {
        this.runs = runs;
        this.jobs = jobs;
        this.composition = composition;
        this.intervalMs = intervalMs;
    }
    start() {
        if (this.timer)
            return;
        void this.runOnce().catch((error) => console.error("[universal-remake] coordinator pass failed", error));
        this.timer = setInterval(() => void this.runOnce().catch((error) => console.error("[universal-remake] coordinator pass failed", error)), this.intervalMs);
        this.timer.unref?.();
    }
    stop() {
        if (this.timer)
            clearInterval(this.timer);
        this.timer = null;
    }
    async runOnce() {
        for (const run of await this.runs.listActive())
            await this.reconcile(run.id);
    }
    async reconcile(runId) {
        const active = this.reconciliations.get(runId);
        if (active)
            return active;
        const reconciliation = this.reconcileUnlocked(runId);
        this.reconciliations.set(runId, reconciliation);
        try {
            return await reconciliation;
        }
        finally {
            if (this.reconciliations.get(runId) === reconciliation)
                this.reconciliations.delete(runId);
        }
    }
    async reconcileUnlocked(runId) {
        let run = await this.runs.getInternal(runId);
        if (!run || run.status === "cancelled" || run.status === "completed" || run.status === "failed")
            return run;
        for (const candidate of run.candidates.filter((item) => item.status === "running" || item.status === "composing")) {
            await this.advanceCandidate(run, candidate);
            run = await this.runs.getInternal(runId) ?? run;
        }
        if (run.status !== "paused") {
            let available = Math.max(0, run.max_in_flight - run.candidates.filter((item) => item.status === "running" || item.status === "composing").length);
            for (const candidate of run.candidates.filter((item) => item.status === "queued").slice(0, available)) {
                await this.runs.updateCandidate(run.id, candidate.index, { status: "running", error: null, failure_stage: null });
                run = await this.runs.getInternal(run.id) ?? run;
                const current = run.candidates.find((item) => item.index === candidate.index);
                if (current)
                    await this.advanceCandidate(run, current);
                available -= 1;
                if (available <= 0)
                    break;
            }
        }
        return this.refreshRun(run.id);
    }
    async retryComposition(runId, candidateIndex) {
        const run = await this.runs.getInternal(runId);
        const candidate = run?.candidates.find((item) => item.index === candidateIndex);
        if (!run || !candidate)
            throw new Error("通用复刻候选不存在");
        if (candidate.status !== "failed" || candidate.failure_stage !== "composition")
            throw new Error("只有合成失败的候选可以单独重试合成");
        await this.runs.updateCandidate(run.id, candidate.index, {
            status: "composing", failure_stage: null, error: null, composition_attempt: candidate.composition_attempt + 1,
        });
        await this.runs.update(run.id, { status: "running", finished_at: null });
    }
    async pause(runId) { return this.runs.update(runId, { status: "paused", finished_at: null }); }
    async resume(runId) { return this.runs.update(runId, { status: "running", finished_at: null }); }
    async cancel(runId) {
        const run = await this.runs.getInternal(runId);
        if (!run)
            return null;
        const jobs = await this.jobs.list(run.user_id, { batchId: run.id });
        await Promise.all(jobs.map((job) => this.jobs.update(job.id, job.status === "queued"
            ? { status: "cancelled", finished_at: new Date().toISOString() }
            : activeJobStatuses.has(job.status) ? { status: "cancel_requested" } : {})));
        for (const candidate of run.candidates.filter((item) => !["succeeded", "failed", "cancelled"].includes(item.status))) {
            await this.runs.updateCandidate(run.id, candidate.index, { status: "cancelled" });
        }
        return this.runs.update(run.id, { status: "cancelled", finished_at: new Date().toISOString() });
    }
    async advanceCandidate(run, candidate) {
        if (candidate.status === "composing")
            return this.compose(run, candidate);
        const segmentIndex = candidate.segment_artifact_uris.length;
        const currentJobId = candidate.segment_job_ids[segmentIndex];
        if (!currentJobId) {
            if (segmentIndex >= candidate.manifest.segments.length)
                return this.finishOrCompose(run, candidate);
            return this.createSegmentJob(run, candidate, segmentIndex);
        }
        const job = await this.jobs.get(run.user_id, currentJobId);
        if (!job) {
            await this.runs.updateCandidate(run.id, candidate.index, { status: "failed", failure_stage: "segment", error: "分段任务丢失" });
            return;
        }
        if (job.status === "failed" || job.status === "cancelled") {
            await this.runs.updateCandidate(run.id, candidate.index, { status: job.status === "cancelled" ? "cancelled" : "failed", failure_stage: "segment", error: readJobError(job) });
            return;
        }
        if (job.status !== "succeeded")
            return;
        const artifactUri = readArtifactUri(job);
        if (!artifactUri) {
            await this.runs.updateCandidate(run.id, candidate.index, { status: "failed", failure_stage: "segment", error: "分段任务完成但没有托管视频素材" });
            return;
        }
        const artifacts = [...candidate.segment_artifact_uris, artifactUri];
        await this.runs.updateCandidate(run.id, candidate.index, { segment_artifact_uris: artifacts });
        const refreshed = (await this.runs.getInternal(run.id))?.candidates.find((item) => item.index === candidate.index);
        if (!refreshed)
            return;
        if (artifacts.length >= refreshed.manifest.segments.length)
            return this.finishOrCompose(run, refreshed);
        return this.createSegmentJob(run, refreshed, artifacts.length);
    }
    async createSegmentJob(run, candidate, segmentIndex) {
        const segment = candidate.manifest.segments[segmentIndex];
        if (!segment)
            return;
        let continuationFrameArtifactUri = null;
        if (segmentIndex > 0 && typeof segment.continuationFrameFromSegmentId === "string") {
            const continuationFrames = [...(candidate.continuation_frame_artifact_uris || [])];
            continuationFrameArtifactUri = continuationFrames[segmentIndex] || null;
            if (!continuationFrameArtifactUri) {
                const previousSegmentArtifactUri = candidate.segment_artifact_uris[segmentIndex - 1];
                if (!previousSegmentArtifactUri) {
                    await this.failSegment(run, candidate, "续接帧缺少上一段视频素材");
                    return;
                }
                try {
                    const extracted = await this.composition.extractContinuationFrame(run, candidate, previousSegmentArtifactUri);
                    if (!extracted.artifactUri.startsWith("canvas-artifact:"))
                        throw new Error("续接帧提取器没有返回托管画布素材");
                    continuationFrameArtifactUri = extracted.artifactUri;
                    continuationFrames[segmentIndex] = continuationFrameArtifactUri;
                    await this.runs.updateCandidate(run.id, candidate.index, { continuation_frame_artifact_uris: continuationFrames });
                }
                catch (error) {
                    await this.failSegment(run, candidate, `续接帧提取失败：${error instanceof Error ? error.message : "未知错误"}`);
                    return;
                }
            }
        }
        const providerDurationSeconds = Math.max(1, Math.ceil(segment.durationSeconds));
        const attempt = candidate.segment_job_ids.filter((_, index) => index === segmentIndex).length + 1;
        const job = await this.jobs.create(run.user_id, {
            canvas_id: run.canvas_id, batch_id: run.id, candidate_index: candidate.index,
            target_node_id: `${run.target_node_id}:${candidate.index}:${segmentIndex}`,
            generation_revision: run.generation_revision,
            client_request_id: `${run.client_request_id}:candidate:${candidate.index}:segment:${segmentIndex}:attempt:${attempt}`,
            kind: "viral-video", model_id: run.model_id, channel_id: run.channel_id,
            input: {
                ...segment, runId: run.id, candidateIndex: candidate.index, segmentIndex,
                seconds: String(providerDurationSeconds), duration: String(providerDurationSeconds),
                referenceImages: prioritizeContinuationFrame(segment.referenceAssetIds, continuationFrameArtifactUri, segment.maxReferenceImages),
                referenceVideos: [],
                generateAudio: true,
            }, max_attempts: 1,
        });
        const ids = [...candidate.segment_job_ids];
        ids[segmentIndex] = job.id;
        await this.runs.updateCandidate(run.id, candidate.index, { status: "running", segment_job_ids: ids });
    }
    async failSegment(run, candidate, error) {
        await this.runs.updateCandidate(run.id, candidate.index, { status: "failed", failure_stage: "segment", error });
    }
    async finishOrCompose(run, candidate) {
        if (candidate.manifest.output.kind === "direct-video") {
            await this.runs.updateCandidate(run.id, candidate.index, { status: "succeeded", output_artifact_uri: candidate.segment_artifact_uris[0] ?? null });
            return;
        }
        await this.runs.updateCandidate(run.id, candidate.index, { status: "composing" });
        const refreshed = (await this.runs.getInternal(run.id))?.candidates.find((item) => item.index === candidate.index);
        if (refreshed)
            await this.compose(run, refreshed);
    }
    async compose(run, candidate) {
        try {
            const result = await this.composition.compose(run, candidate, candidate.segment_artifact_uris);
            if (!result.artifactUri.startsWith("canvas-artifact:"))
                throw new Error("合成器没有返回托管画布素材");
            await this.runs.updateCandidate(run.id, candidate.index, { status: "succeeded", output_artifact_uri: result.artifactUri, error: null, failure_stage: null });
        }
        catch (error) {
            await this.runs.updateCandidate(run.id, candidate.index, {
                status: "failed", failure_stage: "composition", error: error instanceof Error ? error.message : "视频合成失败",
            });
        }
    }
    async refreshRun(runId) {
        const run = await this.runs.getInternal(runId);
        if (!run)
            return null;
        const succeeded_count = run.candidates.filter((item) => item.status === "succeeded").length;
        const failed_count = run.candidates.filter((item) => item.status === "failed").length;
        const cancelled_count = run.candidates.filter((item) => item.status === "cancelled").length;
        const terminal = succeeded_count + failed_count + cancelled_count;
        const status = run.status === "paused" || run.status === "cancelled" ? run.status
            : terminal === run.candidates.length ? (failed_count > 0 ? "failed" : "completed") : "running";
        return this.runs.update(run.id, {
            succeeded_count, failed_count, cancelled_count, status,
            finished_at: status === "completed" || status === "failed" || status === "cancelled" ? new Date().toISOString() : null,
        });
    }
}
function readArtifactUri(job) {
    const direct = job.result?.artifactUri ?? job.result?.storageKey ?? job.result?.uri;
    if (typeof direct === "string" && direct.startsWith("canvas-artifact:"))
        return direct;
    const patch = job.result_patch?.nodePatch;
    const metadata = patch?.metadata && typeof patch.metadata === "object" && !Array.isArray(patch.metadata) ? patch.metadata : {};
    const patched = patch?.artifactUri ?? metadata.storageKey ?? patch?.uri;
    return typeof patched === "string" && patched.startsWith("canvas-artifact:") ? patched : null;
}
function readJobError(job) {
    const value = job.error?.message ?? job.error?.error;
    return typeof value === "string" ? value : "分段视频生成失败";
}
function prioritizeContinuationFrame(referenceAssetIds, continuationFrameArtifactUri, configuredLimit) {
    const references = [...new Set(referenceAssetIds.filter((value) => typeof value === "string" && value.trim()))];
    if (!continuationFrameArtifactUri)
        return references;
    const requestedLimit = Number(configuredLimit);
    const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? requestedLimit : Math.max(1, references.length);
    return [continuationFrameArtifactUri, ...references.filter((uri) => uri !== continuationFrameArtifactUri)].slice(0, limit);
}
//# sourceMappingURL=coordinator.js.map