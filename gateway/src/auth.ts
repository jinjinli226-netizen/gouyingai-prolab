import type { NextFunction, Request, Response } from "express";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export function bearerToken(req: Request) {
    const header = req.headers.authorization || "";
    return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

export function createRequireAuth(client: SupabaseClient) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const token = bearerToken(req);
        if (!token) return void res.status(401).json({ error: "缺少访问令牌" });
        const { data, error } = await client.auth.getUser(token);
        if (error || !data.user) return void res.status(401).json({ error: "访问令牌无效或已过期" });
        res.locals.user = data.user as User;
        res.locals.accessToken = token;
        next();
    };
}

export function createRequireAdmin(admin: SupabaseClient) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const user = res.locals.user as User | undefined;
        if (!user) return void res.status(401).json({ error: "未登录" });
        const { data } = await admin
            .from("gouyingai_admins")
            .select("user_id")
            .eq("user_id", user.id)
            .maybeSingle();
        if (!data) return void res.status(403).json({ error: "需要管理员权限" });
        next();
    };
}
