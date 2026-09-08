import { create } from "zustand";
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware";

import { nanoid } from "nanoid";
import { localForageStorage } from "@/lib/localforage-storage";
import type { CanvasBackgroundMode } from "@/lib/canvas-theme";
import type { CanvasAssistantSession, CanvasConnection, CanvasNodeData, CanvasWorkflowState, ViewportTransform } from "@/types/canvas";

export type CanvasProject = {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    revision?: number;
    nodes: CanvasNodeData[];
    connections: CanvasConnection[];
    chatSessions: CanvasAssistantSession[];
    activeChatId: string | null;
    backgroundMode: CanvasBackgroundMode;
    showImageInfo: boolean;
    viewport: ViewportTransform;
    workflow?: CanvasWorkflowState;
};

type CanvasStore = {
    hydrated: boolean;
    projects: CanvasProject[];
    createProject: (title?: string) => string;
    importProject: (project: Partial<CanvasProject>) => string;
    openProject: (id: string) => CanvasProject | null;
    renameProject: (id: string, title: string) => void;
    deleteProjects: (ids: string[]) => void;
    replaceProjects: (projects: CanvasProject[]) => void;
    updateProject: (id: string, patch: Partial<Pick<CanvasProject, "nodes" | "connections" | "chatSessions" | "activeChatId" | "backgroundMode" | "showImageInfo" | "viewport" | "workflow">>) => void;
};

const initialViewport: ViewportTransform = { x: 0, y: 0, k: 1 };
const CANVAS_LEGACY_STORE_KEY = "gouyingai:canvas_store";
const CANVAS_PROJECT_INDEX_KEY = "gouyingai:canvas:index:v2";
const CANVAS_PROJECT_KEY_PREFIX = "gouyingai:canvas:project:v2:";
const CANVAS_BROADCAST_CHANNEL = "gouyingai:canvas-projects:v2";
type PersistedCanvasState = Pick<CanvasStore, "projects">;
type CanvasProjectIndexItem = Pick<CanvasProject, "id" | "updatedAt" | "revision">;
const projectSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
let indexSaveTimer: ReturnType<typeof setTimeout> | null = null;
const pendingIndexChanges = new Map<string, CanvasProject>();
const pendingIndexDeletes = new Set<string>();
let queuedPersistState: PersistedCanvasState | null = null;
let fallbackStorageQueue = Promise.resolve();
const canvasStorageOrigin = nanoid();
const canvasBroadcast = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CANVAS_BROADCAST_CHANNEL);

const canvasStorage: PersistStorage<CanvasStore> = {
    getItem: async (name) => {
        const indexJson = await localForageStorage.getItem(CANVAS_PROJECT_INDEX_KEY);
        if (indexJson) {
            const index = JSON.parse(indexJson) as CanvasProjectIndexItem[];
            const projects = (await Promise.all(index.map(async (item) => {
                const value = await localForageStorage.getItem(projectStorageKey(item.id));
                return value ? normalizeStoredProject(JSON.parse(value) as CanvasProject) : null;
            }))).filter((project): project is CanvasProject => Boolean(project));
            const state = { projects: sortProjects(projects) };
            queuedPersistState = state;
            return { state } as StorageValue<CanvasStore>;
        }
        const legacyValue = await localForageStorage.getItem(name || CANVAS_LEGACY_STORE_KEY);
        if (!legacyValue) return null;
        const parsed = JSON.parse(legacyValue) as StorageValue<CanvasStore>;
        const projects = ((parsed.state as PersistedCanvasState).projects || []).map(normalizeStoredProject);
        queuedPersistState = { projects };
        void migrateLegacyProjects(projects);
        return { ...parsed, state: { ...(parsed.state as CanvasStore), projects } };
    },
    setItem: (_name, value) => {
        const nextState = value.state as PersistedCanvasState;
        if (queuedPersistState && queuedPersistState.projects === nextState.projects) return;
        const previousById = new Map((queuedPersistState?.projects || []).map((project) => [project.id, project]));
        const nextIds = new Set(nextState.projects.map((project) => project.id));
        const changed = nextState.projects.filter((project) => previousById.get(project.id) !== project);
        const deletedIds = [...previousById.keys()].filter((id) => !nextIds.has(id));
        queuedPersistState = nextState;
        changed.forEach(scheduleProjectSave);
        deletedIds.forEach(scheduleProjectDelete);
        scheduleIndexPatch(changed, deletedIds);
    },
    removeItem: async () => {
        const projects = queuedPersistState?.projects || [];
        await Promise.all(projects.map((project) => localForageStorage.removeItem(projectStorageKey(project.id))));
        await localForageStorage.removeItem(CANVAS_PROJECT_INDEX_KEY);
        await localForageStorage.removeItem(CANVAS_LEGACY_STORE_KEY);
    },
};

function projectStorageKey(projectId: string) {
    return `${CANVAS_PROJECT_KEY_PREFIX}${projectId}`;
}

function normalizeStoredProject(project: CanvasProject): CanvasProject {
    return { ...project, revision: Math.max(1, Number(project.revision) || 1) };
}

function sortProjects(projects: CanvasProject[]) {
    return [...projects].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function scheduleProjectSave(project: CanvasProject) {
    const previous = projectSaveTimers.get(project.id);
    if (previous) clearTimeout(previous);
    projectSaveTimers.set(project.id, setTimeout(() => {
        projectSaveTimers.delete(project.id);
        void withCanvasStorageLock(`project:${project.id}`, async () => {
            const key = projectStorageKey(project.id);
            const storedJson = await localForageStorage.getItem(key);
            const stored = storedJson ? normalizeStoredProject(JSON.parse(storedJson) as CanvasProject) : null;
            if (stored && (stored.revision || 0) > (project.revision || 0)) return;
            if (stored && stored.revision === project.revision && stored.updatedAt > project.updatedAt) return;
            await localForageStorage.setItem(key, JSON.stringify(project));
            canvasBroadcast?.postMessage({ origin: canvasStorageOrigin, projectId: project.id });
        });
    }, 250));
}

function scheduleProjectDelete(projectId: string) {
    const previous = projectSaveTimers.get(projectId);
    if (previous) clearTimeout(previous);
    projectSaveTimers.delete(projectId);
    void withCanvasStorageLock(`project:${projectId}`, async () => {
        await localForageStorage.removeItem(projectStorageKey(projectId));
        canvasBroadcast?.postMessage({ origin: canvasStorageOrigin, projectId, deleted: true });
    });
}

function scheduleIndexPatch(changed: CanvasProject[], deletedIds: string[]) {
    changed.forEach((project) => {
        pendingIndexDeletes.delete(project.id);
        pendingIndexChanges.set(project.id, project);
    });
    deletedIds.forEach((id) => {
        pendingIndexChanges.delete(id);
        pendingIndexDeletes.add(id);
    });
    if (indexSaveTimer) clearTimeout(indexSaveTimer);
    indexSaveTimer = setTimeout(() => {
        indexSaveTimer = null;
        const accumulatedChanges = [...pendingIndexChanges.values()];
        const accumulatedDeletes = [...pendingIndexDeletes];
        pendingIndexChanges.clear();
        pendingIndexDeletes.clear();
        void persistIndexPatch(accumulatedChanges, accumulatedDeletes);
    }, 280);
}

async function persistIndexPatch(changed: CanvasProject[], deletedIds: string[]) {
    await withCanvasStorageLock("index", async () => {
        const value = await localForageStorage.getItem(CANVAS_PROJECT_INDEX_KEY);
        const current = value ? JSON.parse(value) as CanvasProjectIndexItem[] : [];
        const byId = new Map(current.map((item) => [item.id, item]));
        deletedIds.forEach((id) => byId.delete(id));
        changed.forEach((project) => byId.set(project.id, { id: project.id, updatedAt: project.updatedAt, revision: project.revision }));
        await localForageStorage.setItem(CANVAS_PROJECT_INDEX_KEY, JSON.stringify([...byId.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))));
    });
}

async function migrateLegacyProjects(projects: CanvasProject[]) {
    await Promise.all(projects.map(async (project) => localForageStorage.setItem(projectStorageKey(project.id), JSON.stringify(project))));
    await localForageStorage.setItem(CANVAS_PROJECT_INDEX_KEY, JSON.stringify(projects.map((project) => ({ id: project.id, updatedAt: project.updatedAt, revision: project.revision }))));
}

function withCanvasStorageLock<T>(name: string, task: () => Promise<T>) {
    if (typeof navigator !== "undefined" && navigator.locks) return navigator.locks.request(`gouyingai:canvas:${name}`, task);
    const next = fallbackStorageQueue.then(task, task);
    fallbackStorageQueue = next.then(() => undefined, () => undefined);
    return next;
}

export const useCanvasStore = create<CanvasStore>()(
    persist(
        (set, get) => ({
            hydrated: false,
            projects: [],
            createProject: (title = "未命名画布") => {
                const now = new Date().toISOString();
                const id = nanoid();
                const project: CanvasProject = {
                    id,
                    title,
                    createdAt: now,
                    updatedAt: now,
                    revision: 1,
                    nodes: [],
                    connections: [],
                    chatSessions: [],
                    activeChatId: null,
                    backgroundMode: "lines",
                    showImageInfo: false,
                    viewport: initialViewport,
                };
                set((state) => ({ projects: [project, ...state.projects] }));
                return id;
            },
            importProject: (source) => {
                const now = new Date().toISOString();
                const project: CanvasProject = {
                    id: nanoid(),
                    title: source.title || "导入画布",
                    createdAt: source.createdAt || now,
                    updatedAt: now,
                    revision: 1,
                    nodes: source.nodes || [],
                    connections: source.connections || [],
                    chatSessions: source.chatSessions || [],
                    activeChatId: source.activeChatId || null,
                    backgroundMode: source.backgroundMode || "lines",
                    showImageInfo: source.showImageInfo || false,
                    viewport: source.viewport || initialViewport,
                    workflow: source.workflow,
                };
                set((state) => ({ projects: [project, ...state.projects] }));
                return project.id;
            },
            openProject: (id) => {
                return get().projects.find((item) => item.id === id) || null;
            },
            renameProject: (id, title) =>
                set((state) => ({
                    projects: state.projects.map((project) => (project.id === id ? { ...project, title: title.trim() || project.title, updatedAt: new Date().toISOString(), revision: (project.revision || 0) + 1 } : project)),
                })),
            deleteProjects: (ids) =>
                set((state) => {
                    const projects = state.projects.filter((project) => !ids.includes(project.id));
                    return { projects };
                }),
            replaceProjects: (projects) => set({ projects: projects.map((project) => ({ ...project, revision: (project.revision || 0) + 1 })) }),
            updateProject: (id, patch) =>
                set((state) => ({
                    projects: state.projects.map((project) => (project.id === id ? { ...project, ...patch, updatedAt: new Date().toISOString(), revision: (project.revision || 0) + 1 } : project)),
                })),
        }),
        {
            name: CANVAS_LEGACY_STORE_KEY,
            storage: canvasStorage,
            partialize: (state) =>
                ({
                    projects: state.projects,
                }) as StorageValue<CanvasStore>["state"],
            onRehydrateStorage: () => () => {
                useCanvasStore.setState({ hydrated: true });
            },
        },
    ),
);

canvasBroadcast?.addEventListener("message", (event: MessageEvent<{ origin?: string; projectId?: string; deleted?: boolean }>) => {
    const message = event.data;
    if (!message?.projectId || message.origin === canvasStorageOrigin) return;
    void (async () => {
        const current = useCanvasStore.getState().projects;
        let projects: CanvasProject[];
        if (message.deleted) {
            projects = current.filter((project) => project.id !== message.projectId);
        } else {
            const value = await localForageStorage.getItem(projectStorageKey(message.projectId!));
            if (!value) return;
            const incoming = normalizeStoredProject(JSON.parse(value) as CanvasProject);
            const existing = current.find((project) => project.id === incoming.id);
            if (existing && (existing.revision || 0) > (incoming.revision || 0)) return;
            if (existing && existing.revision === incoming.revision && existing.updatedAt >= incoming.updatedAt) return;
            projects = sortProjects([incoming, ...current.filter((project) => project.id !== incoming.id)]);
        }
        queuedPersistState = { projects };
        useCanvasStore.setState({ projects });
    })();
});
