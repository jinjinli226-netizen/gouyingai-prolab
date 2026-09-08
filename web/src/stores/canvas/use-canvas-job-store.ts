import { create } from "zustand";
import { nanoid } from "nanoid";

import { cancelCanvasJob, listCanvasJobs, retryCanvasJob } from "@/services/api/canvas-jobs";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";
import type { CanvasJob } from "@/types/canvas-job";

type CanvasJobStore = {
    jobs: CanvasJob[];
    loading: boolean;
    error: string;
    refresh: () => Promise<void>;
    cancel: (jobId: string) => Promise<void>;
    retry: (job: CanvasJob) => Promise<void>;
};

let refreshPromise: Promise<void> | null = null;

export const useCanvasJobStore = create<CanvasJobStore>((set, get) => ({
    jobs: [],
    loading: false,
    error: "",
    refresh: async () => {
        if (refreshPromise) return refreshPromise;
        set({ loading: true });
        refreshPromise = listCanvasJobs()
            .then((jobs) => set({ jobs, error: "" }))
            .catch((error) => set({ error: error instanceof Error ? error.message : "任务列表读取失败" }))
            .finally(() => {
                refreshPromise = null;
                set({ loading: false });
            });
        return refreshPromise;
    },
    cancel: async (jobId) => {
        try {
            const updated = await cancelCanvasJob(jobId);
            set({ jobs: get().jobs.map((job) => job.id === updated.id ? updated : job), error: "" });
        } catch (error) {
            set({ error: error instanceof Error ? error.message : "任务取消失败" });
        }
    },
    retry: async (job) => {
        try {
            const retried = await retryCanvasJob(job.id, { clientRequestId: nanoid(), generationRevision: job.generationRevision + 1 });
            const project = useCanvasStore.getState().projects.find((item) => item.id === retried.canvasId);
            if (project) {
                useCanvasStore.getState().updateProject(project.id, {
                    nodes: project.nodes.map((node) =>
                        node.id === retried.targetNodeId
                            ? {
                                  ...node,
                                  metadata: {
                                      ...node.metadata,
                                      status: "loading",
                                      errorDetails: undefined,
                                      generationJobId: retried.id,
                                      generationRevision: retried.generationRevision,
                                      generationStatus: retried.status,
                                  },
                              }
                            : node,
                    ),
                });
            }
            set({ jobs: [retried, ...get().jobs], error: "" });
        } catch (error) {
            set({ error: error instanceof Error ? error.message : "任务重新提交失败" });
        }
    },
}));
