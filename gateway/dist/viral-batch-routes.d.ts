import { type Response } from "express";
import type { CanvasJobRepository, PublicViralBatch, ViralBatchRepository } from "./types.js";
export declare function createViralBatchRouter(batches: ViralBatchRepository, jobs: CanvasJobRepository, getUserId: (res: Response) => string): import("express-serve-static-core").Router;
export declare function toPublicViralBatch(batch: NonNullable<Awaited<ReturnType<ViralBatchRepository["get"]>>>): PublicViralBatch;
