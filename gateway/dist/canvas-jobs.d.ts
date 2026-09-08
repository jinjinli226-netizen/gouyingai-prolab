import type { CanvasJob, CanvasJobResultPatch, CanvasJobStatus, PublicCanvasJob } from "./types.js";
export declare function canTransitionCanvasJob(from: CanvasJobStatus, to: CanvasJobStatus): boolean;
export declare function matchesCanvasJobResultPatch(job: CanvasJob, patch: CanvasJobResultPatch): boolean;
export declare function toPublicCanvasJob(job: CanvasJob): PublicCanvasJob;
