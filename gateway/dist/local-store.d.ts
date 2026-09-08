import type { ApiFormat, CanvasArtifact, CanvasJob, CanvasJobCreateInput, CanvasJobStatus, Channel, GatewayTask, Model, ViralBatch, ViralBatchCreateInput } from "./types.js";
import type { UniversalRemakeRun, UniversalRemakeRunCreateInput, UniversalRunCandidate } from "./universal-viral-remake/types.js";
export type UsageRecord = {
    id: string;
    user_id: string;
    model_id: string | null;
    capability: string;
    status: string;
    tokens: number;
    created_at: string;
};
export type LocalStoreData = {
    channels: Channel[];
    models: Model[];
    admins: string[];
    usage: UsageRecord[];
    tasks: GatewayTask[];
    canvasJobs: CanvasJob[];
    canvasArtifacts: CanvasArtifact[];
    viralBatches: ViralBatch[];
    universalRemakeRuns: UniversalRemakeRun[];
};
export declare class LocalStore {
    private filePath;
    private data;
    constructor(filePath: string);
    private save;
    listChannels(): Channel[];
    getChannel(id: string): Channel | undefined;
    createChannel(input: {
        name: string;
        base_url: string;
        api_format: ApiFormat;
        key_ciphertext: string;
        enabled: boolean;
    }): Channel;
    updateChannel(id: string, patch: Partial<Omit<Channel, "id">>): Channel | undefined;
    deleteChannel(id: string): boolean;
    listModels(): Model[];
    createModel(input: Omit<Model, "id">): Model;
    updateModel(id: string, patch: Partial<Omit<Model, "id">>): Model | undefined;
    deleteModel(id: string): boolean;
    listUsage(limit: number): UsageRecord[];
    addUsage(record: Omit<UsageRecord, "id" | "created_at">): void;
    saveTask(task: GatewayTask): void;
    getTask(taskId: string): GatewayTask | undefined;
    saveCanvasArtifact(userId: string, canvasId: string, input: {
        name: string;
        mimeType: string;
        bytes: Buffer;
        checksum: string;
    }): CanvasArtifact;
    readCanvasArtifact(userId: string, canvasId: string, uri: string): {
        bytes: NonSharedBuffer;
        id: string;
        user_id: string;
        canvas_id: string;
        uri: string;
        file_path: string;
        name: string;
        mime_type: string;
        checksum: string;
        created_at: string;
    } | undefined;
    createCanvasJob(userId: string, input: CanvasJobCreateInput): CanvasJob;
    getCanvasJob(userId: string, jobId: string): CanvasJob | undefined;
    getCanvasJobInternal(jobId: string): CanvasJob | undefined;
    listCanvasJobs(userId: string, filters?: {
        canvasId?: string;
        status?: CanvasJobStatus;
        batchId?: string;
    }): CanvasJob[];
    updateCanvasJob(jobId: string, patch: Partial<CanvasJob>): CanvasJob | undefined;
    claimCanvasJobs(workerId: string, limit: number, leaseSeconds: number, now?: Date): CanvasJob[];
    createViralBatch(userId: string, input: ViralBatchCreateInput): ViralBatch;
    getViralBatch(userId: string, batchId: string): ViralBatch | undefined;
    getViralBatchInternal(batchId: string): ViralBatch | undefined;
    listViralBatches(userId: string, canvasId?: string): ViralBatch[];
    listActiveViralBatches(): ViralBatch[];
    updateViralBatch(batchId: string, patch: Partial<ViralBatch>): ViralBatch | undefined;
    createUniversalRemakeRun(userId: string, input: UniversalRemakeRunCreateInput): UniversalRemakeRun;
    getUniversalRemakeRun(userId: string, runId: string): UniversalRemakeRun | undefined;
    getUniversalRemakeRunInternal(runId: string): UniversalRemakeRun | undefined;
    listUniversalRemakeRuns(userId: string, canvasId?: string): UniversalRemakeRun[];
    listActiveUniversalRemakeRuns(): UniversalRemakeRun[];
    updateUniversalRemakeRun(runId: string, patch: Partial<UniversalRemakeRun>): UniversalRemakeRun | undefined;
    updateUniversalRemakeCandidate(runId: string, candidateIndex: number, patch: Partial<UniversalRunCandidate>): UniversalRemakeRun | undefined;
}
