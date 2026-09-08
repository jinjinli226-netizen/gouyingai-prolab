import type { SupabaseClient } from "@supabase/supabase-js";
import { type Response } from "express";
import type { LocalStore } from "./local-store.js";
export declare function createLocalCanvasArtifactRouter(store: LocalStore, getUserId?: (res: Response) => string): import("express-serve-static-core").Router;
export declare function createSupabaseCanvasArtifactRouter(admin: SupabaseClient, getUserId: (res: Response) => string): import("express-serve-static-core").Router;
export declare function isOwnedCanvasArtifactPath(userId: string, canvasId: string, path: string): boolean;
export declare function canvasArtifactStoragePath(uri: string): string;
