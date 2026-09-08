import { type Response } from "express";
import type { CanvasJobRepository } from "./types.js";
export declare function createCanvasJobRouter(repository: CanvasJobRepository, getUserId: (res: Response) => string): import("express-serve-static-core").Router;
