import { type Response } from "express";
import type { UniversalRemakeCoordinator } from "./coordinator.js";
import type { UniversalRemakeRunRepository } from "./types.js";
export declare function createUniversalRemakeRouter(runs: UniversalRemakeRunRepository, coordinator: UniversalRemakeCoordinator, getUserId: (res: Response) => string): import("express-serve-static-core").Router;
