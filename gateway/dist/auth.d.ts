import type { NextFunction, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
export declare function bearerToken(req: Request): string;
export declare function createRequireAuth(client: SupabaseClient): (req: Request, res: Response, next: NextFunction) => Promise<undefined>;
export declare function createRequireAdmin(admin: SupabaseClient): (req: Request, res: Response, next: NextFunction) => Promise<undefined>;
