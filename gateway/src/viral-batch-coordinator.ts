import type { CanvasJobRepository, CanvasJobStatus, ViralBatchRepository } from "./types.js";

const activeJobStatuses = new Set<CanvasJobStatus>(["queued", "leased", "submitting", "running", "cancel_requested"]);

export async function materializeViralBatchWindow(batchId: string, batches: ViralBatchRepository, jobs: CanvasJobRepository) {
    const batch = await batches.getInternal(batchId);
    if (!batch || !["queued", "running"].includes(batch.status)) return batch;
    const children = (await jobs.list(batch.user_id, { batchId: batch.id })).filter((job) => job.kind === "viral-video");
    const activeCount = children.filter((job) => activeJobStatuses.has(job.status)).length;
    const available = Math.max(0, batch.max_in_flight - activeCount);
    const manifests = Array.isArray(batch.input.manifests) ? batch.input.manifests as Array<Record<string, unknown>> : [];
    const baseVideoInput = batch.input.baseVideoInput && typeof batch.input.baseVideoInput === "object" && !Array.isArray(batch.input.baseVideoInput) ? batch.input.baseVideoInput as Record<string, unknown> : {};
    const upperBound = Math.min(batch.candidate_count, manifests.length);
    let nextIndex = batch.next_candidate_index;
    for (let offset = 0; offset < available && nextIndex < upperBound; offset += 1, nextIndex += 1) {
        const manifest = manifests[nextIndex];
        await jobs.create(batch.user_id, {
            canvas_id: batch.canvas_id,
            batch_id: batch.id,
            candidate_index: nextIndex,
            target_node_id: `${batch.target_node_id}:${nextIndex}`,
            generation_revision: batch.generation_revision,
            client_request_id: `${batch.client_request_id}:candidate:${nextIndex}`,
            kind: "viral-video",
            model_id: batch.model_id,
            channel_id: batch.channel_id,
            input: { ...baseVideoInput, prompt: typeof manifest.prompt === "string" ? manifest.prompt : "", manifest, batchId: batch.id, candidateIndex: nextIndex },
            max_attempts: 1,
        });
    }
    return batches.update(batch.id, { status: nextIndex >= upperBound && upperBound === 0 ? "failed" : "running", next_candidate_index: nextIndex });
}

export async function reconcileViralBatch(batchId: string, batches: ViralBatchRepository, jobs: CanvasJobRepository) {
    const batch = await batches.getInternal(batchId);
    if (!batch) return null;
    const children = (await jobs.list(batch.user_id, { batchId: batch.id })).filter((job) => job.kind === "viral-video");
    const counts = { queued_count: 0, running_count: 0, succeeded_count: 0, failed_count: 0, cancelled_count: 0 };
    children.forEach((job) => {
        if (job.status === "queued" || job.status === "leased" || job.status === "submitting") counts.queued_count += 1;
        else if (job.status === "running" || job.status === "cancel_requested") counts.running_count += 1;
        else if (job.status === "succeeded") counts.succeeded_count += 1;
        else if (job.status === "failed") counts.failed_count += 1;
        else if (job.status === "cancelled") counts.cancelled_count += 1;
    });
    const terminalCount = counts.succeeded_count + counts.failed_count + counts.cancelled_count;
    const allMaterialized = batch.next_candidate_index >= batch.candidate_count;
    const status = batch.status === "cancelled" || batch.status === "paused"
        ? batch.status
        : allMaterialized && terminalCount >= batch.candidate_count
          ? counts.succeeded_count > 0 ? "completed" : "failed"
          : "running";
    return batches.update(batch.id, { ...counts, status, finished_at: status === "completed" || status === "failed" || status === "cancelled" ? new Date().toISOString() : null });
}

export class ViralBatchCoordinator {
    private timer: ReturnType<typeof setInterval> | null = null;
    constructor(private batches: ViralBatchRepository, private jobs: CanvasJobRepository, private intervalMs = 1000) {}
    start() { if (!this.timer) { void this.runOnce(); this.timer = setInterval(() => void this.runOnce(), this.intervalMs); this.timer.unref?.(); } }
    stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
    async runOnce() {
        for (const batch of await this.batches.listActive()) {
            await reconcileViralBatch(batch.id, this.batches, this.jobs);
            await materializeViralBatchWindow(batch.id, this.batches, this.jobs);
        }
    }
}
