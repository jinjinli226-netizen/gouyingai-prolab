import type { CanvasJob } from "@/types/canvas-job";
import type { CanvasNodeData, CanvasNodeMetadata } from "@/types/canvas";

const activeStatuses = new Set(["queued", "leased", "submitting", "running", "cancel_requested"]);

export function resetInterruptedCanvasGeneration(nodes: CanvasNodeData[]) {
    let changed = false;
    const next = nodes.map((node) => {
        if (node.metadata?.status !== "loading") return node;
        changed = true;
        if (node.metadata.generationJobId) {
            return {
                ...node,
                metadata: {
                    ...node.metadata,
                    generationStatus: node.metadata.generationStatus || "queued",
                    errorDetails: undefined,
                },
            };
        }
        return {
            ...node,
            metadata: {
                ...node.metadata,
                status: "error" as const,
                errorDetails: "页面刷新后旧版生成已中断，请重新生成。",
            },
        };
    });
    return changed ? next : nodes;
}

export function reconcileCanvasJobs(canvasId: string, nodes: CanvasNodeData[], jobs: CanvasJob[]) {
    return jobs.reduce((current, job) => reconcileCanvasJob(canvasId, current, job), nodes);
}

export function reconcileCanvasJob(canvasId: string, nodes: CanvasNodeData[], job: CanvasJob) {
    if (job.canvasId !== canvasId) return nodes;
    let index = nodes.findIndex((node) => node.id === job.targetNodeId && node.metadata?.generationJobId === job.id && node.metadata?.generationRevision === job.generationRevision);
    if (index < 0 && job.parentJobId) {
        index = nodes.findIndex((node) => node.id === job.targetNodeId && node.metadata?.generationJobId === job.parentJobId && (node.metadata?.generationRevision || 0) < job.generationRevision);
    }
    if (index < 0) return nodes;
    const node = nodes[index];
    const adoptingRetry = node.metadata?.generationJobId !== job.id;
    let updated: CanvasNodeData;

    if (activeStatuses.has(job.status)) {
        if (!adoptingRetry && node.metadata?.status === "loading" && node.metadata.generationStatus === job.status && !node.metadata.errorDetails) return nodes;
        updated = {
            ...node,
            metadata: { ...node.metadata, status: "loading", generationJobId: job.id, generationRevision: job.generationRevision, generationStatus: job.status, errorDetails: undefined },
        };
    } else if (job.status === "failed" || job.status === "cancelled") {
        const errorDetails = job.status === "cancelled" ? "生成任务已取消" : canvasJobError(job);
        if (node.metadata?.status === "error" && node.metadata.generationStatus === job.status && node.metadata.errorDetails === errorDetails) return nodes;
        updated = {
            ...node,
            metadata: { ...node.metadata, status: "error", generationJobId: job.id, generationRevision: job.generationRevision, generationStatus: job.status, errorDetails },
        };
    } else if (job.status === "succeeded") {
        const patch = job.resultPatch;
        if (!patch || patch.canvasId !== canvasId || patch.nodeId !== node.id || patch.jobId !== job.id || patch.generationRevision !== job.generationRevision) return nodes;
        if (node.metadata?.generationStatus === "succeeded" && patchAlreadyApplied(node, patch.nodePatch)) return nodes;
        const nodePatch = patch.nodePatch as Partial<CanvasNodeData>;
        const metadataPatch = (nodePatch.metadata || {}) as CanvasNodeMetadata;
        updated = {
            ...node,
            ...nodePatch,
            id: node.id,
            metadata: {
                ...node.metadata,
                ...metadataPatch,
                generationJobId: job.id,
                generationRevision: job.generationRevision,
                generationStatus: "succeeded",
                status: "success",
                errorDetails: undefined,
            },
        };
    } else {
        return nodes;
    }

    const next = [...nodes];
    next[index] = updated;
    if (job.status === "succeeded" && node.metadata?.batchRootId) {
        const rootIndex = next.findIndex((candidate) => candidate.id === node.metadata?.batchRootId && candidate.metadata?.isBatchRoot);
        if (rootIndex >= 0) {
            const root = next[rootIndex];
            const patch = job.resultPatch?.nodePatch as Partial<CanvasNodeData> | undefined;
            const patchMetadata = (patch?.metadata || {}) as CanvasNodeMetadata;
            if (!root.metadata?.primaryImageId || root.metadata.primaryImageId === node.id) {
                next[rootIndex] = {
                    ...root,
                    ...(patch?.width ? { width: patch.width } : {}),
                    ...(patch?.height ? { height: patch.height } : {}),
                    metadata: {
                        ...root.metadata,
                        ...patchMetadata,
                        primaryImageId: node.id,
                        status: "success",
                        errorDetails: undefined,
                    },
                };
            }
        }
    }
    return next;
}

function canvasJobError(job: CanvasJob) {
    const message = job.error?.message;
    return typeof message === "string" && message.trim() ? message : "生成失败";
}

function patchAlreadyApplied(node: CanvasNodeData, patch: Record<string, unknown>) {
    return Object.entries(patch).every(([key, value]) => {
        if (key !== "metadata") return Object.is(node[key as keyof CanvasNodeData], value);
        const metadata = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
        return Object.entries(metadata).every(([metadataKey, metadataValue]) => Object.is(node.metadata?.[metadataKey as keyof CanvasNodeMetadata], metadataValue));
    });
}
