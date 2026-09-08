import { create } from "zustand";
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware";

import { localForageStorage } from "@/lib/localforage-storage";
import type { ViralBatch } from "@/services/api/viral-batches";

type ViralBatchStore = {
    hydrated: boolean;
    batches: ViralBatch[];
    upsertBatch: (batch: ViralBatch) => void;
    replaceCanvasBatches: (canvasId: string, batches: ViralBatch[]) => void;
    removeBatch: (batchId: string) => void;
};

const storage: PersistStorage<ViralBatchStore> = {
    getItem: async (name) => {
        const value = await localForageStorage.getItem(name);
        return value ? JSON.parse(value) as StorageValue<ViralBatchStore> : null;
    },
    setItem: (name, value) => localForageStorage.setItem(name, JSON.stringify(value)),
    removeItem: (name) => localForageStorage.removeItem(name),
};

export const useViralBatchStore = create<ViralBatchStore>()(persist((set) => ({
    hydrated: false,
    batches: [],
    upsertBatch: (batch) => set((state) => ({ batches: [batch, ...state.batches.filter((item) => item.id !== batch.id)] })),
    replaceCanvasBatches: (canvasId, batches) => set((state) => ({ batches: [...batches, ...state.batches.filter((item) => item.canvasId !== canvasId)] })),
    removeBatch: (batchId) => set((state) => ({ batches: state.batches.filter((item) => item.id !== batchId) })),
}), {
    name: "gouyingai:viral_batch_store",
    storage,
    partialize: (state) => ({ batches: state.batches }) as StorageValue<ViralBatchStore>["state"],
    onRehydrateStorage: () => () => useViralBatchStore.setState({ hydrated: true }),
}));
