export function bearerToken(req) {
    const header = req.headers.authorization || "";
    return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}
export function createRequireAuth(client) {
    return async (req, res, next) => {
        const token = bearerToken(req);
        if (!token)
            return void res.status(401).json({ error: "缺少访问令牌" });
        const { data, error } = await client.auth.getUser(token);
        if (error || !data.user)
            return void res.status(401).json({ error: "访问令牌无效或已过期" });
        res.locals.user = data.user;
        res.locals.accessToken = token;
        next();
    };
}
export function createRequireAdmin(admin) {
    return async (req, res, next) => {
        const user = res.locals.user;
        if (!user)
            return void res.status(401).json({ error: "未登录" });
        const { data } = await admin
            .from("gouyingai_admins")
            .select("user_id")
            .eq("user_id", user.id)
            .maybeSingle();
        if (!data)
            return void res.status(403).json({ error: "需要管理员权限" });
        next();
    };
}
//# sourceMappingURL=auth.js.map