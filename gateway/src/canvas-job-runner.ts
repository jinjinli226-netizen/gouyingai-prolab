import { randomUUID } from "node:crypto";

import type { CanvasJobRunnerSettings } from "./canvas-job-settings.js";
import type { CanvasJob, CanvasJobRepository } from "./types.js";

export type CanvasJobHandlerContext = {
    job: CanvasJob;
    signal: AbortSignal;
    update: (patch: Partial<CanvasJob>) => Promise<CanvasJob>;
};

export type CanvasJobHandler = (context: CanvasJobHandlerContext) => Promise<Partial<CanvasJob> | void>;

export type CanvasJobRunnerOptions = {
    repository: CanvasJobRepository;
    handler: CanvasJobHandler;
    settings: CanvasJobRunnerSettings;
    workerId?: string;
};

type ActiveJob = {
    job: CanvasJob;
    promise: Promise<void>;
};

export class CanvasJobRunner {
    private readonly repository: CanvasJobRepository;
    private readonly handler: CanvasJobHandler;
    private readonly settings: CanvasJobRunnerSettings;
    private readonly workerId: string;
    private readonly active = new Map<string, ActiveJob>();
    private pollTimer: ReturnType<typeof setInterval> | null = null;
    private stopped = false;
    private claiming = false;

    constructor(options: CanvasJobRunnerOptions) {
        this.repository = options.repository;
        this.handler = options.handler;
        this.settings = options.settings;
        this.workerId = options.workerId || `canvas-worker-${randomUUID()}`;
    }

    get activeCount() {
        return this.active.size;
    }

    start() {
        if (this.pollTimer) return;
        this.stopped = false;
        void this.runOnce();
        this.pollTimer = setInterval(() => void this.runOnce(), this.settings.pollIntervalMs);
        this.pollTimer.unref?.();
    }

    stop() {
        this.stopped = true;
        if (this.pollTimer) clearInterval(this.pollTimer);
        this.pollTimer = null;
    }

    async runOnce() {
        if (this.stopped || this.claiming) return;
        const available = Math.max(0, this.settings.globalConcurrency - this.active.size);
        if (!available) return;
        this.claiming = true;
        try {
            const candidates = await this.repository.claim(this.workerId, Math.max(available, this.settings.claimBatch), this.settings.leaseSeconds);
            const selected = this.selectCandidates(candidates, available);
            const selectedIds = new Set(selected.map((job) => job.id));
            await Promise.all(candidates.filter((job) => !selectedIds.has(job.id)).map((job) => this.releaseClaim(job)));
            for (const job of selected) await this.startJob(job);
        } finally {
            this.claiming = false;
        }
    }

    async waitForIdle() {
        while (this.active.size) {
            await Promise.all([...this.active.values()].map((entry) => entry.promise));
        }
    }

    private selectCandidates(candidates: CanvasJob[], available: number) {
        const queues = new Map<string, CanvasJob[]>();
        for (const candidate of candidates) {
            const queue = queues.get(candidate.canvas_id) || [];
            queue.push(candidate);
            queues.set(candidate.canvas_id, queue);
        }
        const selected: CanvasJob[] = [];
        const activeByCapability = countBy([...this.active.values()].map((entry) => entry.job.kind));
        const activeByChannel = countBy([...this.active.values()].map((entry) => entry.job.channel_id).filter((value): value is string => Boolean(value)));

        while (selected.length < available && queues.size) {
            let progressed = false;
            for (const [canvasId, queue] of [...queues]) {
                const candidateIndex = queue.findIndex((job) => this.withinLimits(job, activeByCapability, activeByChannel));
                if (candidateIndex >= 0) {
                    const [candidate] = queue.splice(candidateIndex, 1);
                    selected.push(candidate);
                    increment(activeByCapability, candidate.kind);
                    if (candidate.channel_id) increment(activeByChannel, candidate.channel_id);
                    progressed = true;
                }
                if (!queue.length) queues.delete(canvasId);
                if (selected.length >= available) break;
            }
            if (!progressed) break;
        }
        return selected;
    }

    private withinLimits(job: CanvasJob, activeByCapability: Map<string, number>, activeByChannel: Map<string, number>) {
        const capabilityLimit = this.settings.capabilityConcurrency[job.kind];
        if (capabilityLimit && (activeByCapability.get(job.kind) || 0) >= capabilityLimit) return false;
        if (job.channel_id) {
            const channelLimit = this.settings.channelConcurrency[job.channel_id];
            if (channelLimit && (activeByChannel.get(job.channel_id) || 0) >= channelLimit) return false;
        }
        return true;
    }

    private async releaseClaim(job: CanvasJob) {
        await this.repository.update(job.id, {
            status: "queued",
            lease_owner: null,
            lease_expires_at: null,
            heartbeat_at: null,
        });
    }

    private async startJob(claimed: CanvasJob) {
        const beforeStart = await this.repository.get(claimed.user_id, claimed.id);
        if (beforeStart?.status === "cancel_requested" || beforeStart?.status === "cancelled") {
            await this.repository.update(claimed.id, {
                status: "cancelled",
                finished_at: beforeStart.finished_at || new Date().toISOString(),
                lease_owner: null,
                lease_expires_at: null,
            });
            return;
        }
        let job = await this.repository.update(claimed.id, { status: "running" }) || claimed;
        const controller = new AbortController();
        const heartbeat = setInterval(() => {
            void (async () => {
                const latest = await this.repository.get(job.user_id, job.id);
                if (!latest) return;
                if (latest.status === "cancel_requested" || latest.status === "cancelled") {
                    job = latest;
                    controller.abort();
                    return;
                }
                const now = new Date();
                const updated = await this.repository.update(job.id, {
                    lease_owner: this.workerId,
                    lease_expires_at: new Date(now.getTime() + this.settings.leaseSeconds * 1000).toISOString(),
                    heartbeat_at: now.toISOString(),
                });
                if (updated) job = updated;
            })().catch(() => undefined);
        }, this.settings.heartbeatIntervalMs);
        heartbeat.unref?.();

        const update = async (patch: Partial<CanvasJob>) => {
            const updated = await this.repository.update(job.id, patch);
            if (!updated) throw new Error(`画布任务 ${job.id} 不存在`);
            job = updated;
            const active = this.active.get(job.id);
            if (active) active.job = updated;
            return updated;
        };

        const promise = (async () => {
            try {
                const result = await this.handler({ job, signal: controller.signal, update });
                const latest = await this.repository.get(job.user_id, job.id);
                if (latest?.status === "cancel_requested" || latest?.status === "cancelled") {
                    await update({
                        status: "cancelled",
                        finished_at: latest.finished_at || new Date().toISOString(),
                        lease_owner: null,
                        lease_expires_at: null,
                    });
                    return;
                }
                const terminal = result?.status && ["succeeded", "failed", "cancelled"].includes(result.status);
                await update({
                    ...(result || {}),
                    status: terminal ? result.status : "succeeded",
                    finished_at: result?.finished_at || new Date().toISOString(),
                    lease_owner: null,
                    lease_expires_at: null,
                });
            } catch (error) {
                const latest = await this.repository.get(job.user_id, job.id);
                if (controller.signal.aborted || latest?.status === "cancel_requested" || latest?.status === "cancelled") {
                    await update({
                        status: "cancelled",
                        error: null,
                        finished_at: latest?.finished_at || new Date().toISOString(),
                        lease_owner: null,
                        lease_expires_at: null,
                    });
                    return;
                }
                await update({
                    status: "failed",
                    error: { message: error instanceof Error ? error.message : String(error) },
                    finished_at: new Date().toISOString(),
                    lease_owner: null,
                    lease_expires_at: null,
                });
            } finally {
                clearInterval(heartbeat);
                this.active.delete(claimed.id);
            }
        })();
        this.active.set(claimed.id, { job, promise });
    }
}

function countBy(values: string[]) {
    const counts = new Map<string, number>();
    for (const value of values) increment(counts, value);
    return counts;
}

function increment(counts: Map<string, number>, key: string) {
    counts.set(key, (counts.get(key) || 0) + 1);
}
