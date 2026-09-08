import { createHash, randomUUID } from "node:crypto";
import express from "express";
const MAX_ARTIFACT_BYTES = 100 * 1024 * 1024;
const MEDIA_BUCKET = "gouyingai-media";
export function createLocalCanvasArtifactRouter(store, getUserId = () => "local") {
    const router = createCanvasArtifactRouter(getUserId, async (userId, canvasId, file, bytes, checksum) => {
        const artifact = store.saveCanvasArtifact(userId, canvasId, { name: file.name, mimeType: file.type, bytes, checksum });
        return { id: artifact.id, uri: artifact.uri, name: artifact.name, mimeType: artifact.mime_type, bytes: artifact.bytes, checksum: artifact.checksum };
    });
    router.get("/content", (req, res) => {
        const canvasId = String(req.query.canvasId || "");
        const uri = String(req.query.uri || "");
        const artifact = store.readCanvasArtifact(getUserId(res), canvasId, uri);
        if (!artifact)
            return void res.status(404).json({ error: "画布素材不存在" });
        res.setHeader("content-type", artifact.mime_type);
        res.setHeader("cache-control", "private, max-age=31536000, immutable");
        res.send(artifact.bytes);
    });
    router.get("/url", (req, res) => {
        const canvasId = String(req.query.canvasId || "");
        const uri = String(req.query.uri || "");
        if (!store.readCanvasArtifact(getUserId(res), canvasId, uri))
            return void res.status(404).json({ error: "画布素材不存在" });
        const query = new URLSearchParams({ canvasId, uri });
        res.json({ data: { url: `/v1/canvas-artifacts/content?${query}` } });
    });
    return router;
}
export function createSupabaseCanvasArtifactRouter(admin, getUserId) {
    const router = createCanvasArtifactRouter(getUserId, async (userId, canvasId, file, bytes, checksum) => {
        const id = randomUUID();
        const path = `${encodeURIComponent(userId)}/canvas/${encodeURIComponent(canvasId)}/inputs/${id}-${safeFileName(file.name)}`;
        const { error } = await admin.storage.from(MEDIA_BUCKET).upload(path, bytes, { contentType: file.type, upsert: false });
        if (error)
            throw new Error(error.message);
        return { id, uri: `canvas-artifact:${path}`, name: file.name, mimeType: file.type, bytes: bytes.length, checksum };
    });
    router.get("/url", async (req, res) => {
        try {
            const canvasId = String(req.query.canvasId || "");
            const uri = String(req.query.uri || "");
            const path = canvasArtifactStoragePath(uri);
            if (!canvasId || !isOwnedCanvasArtifactPath(getUserId(res), canvasId, path))
                return void res.status(404).json({ error: "画布素材不存在" });
            const signed = await admin.storage.from(MEDIA_BUCKET).createSignedUrl(path, 24 * 60 * 60);
            if (signed.error || !signed.data?.signedUrl)
                throw new Error(signed.error?.message || "素材签名失败");
            res.json({ data: { url: signed.data.signedUrl } });
        }
        catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : "素材签名失败" });
        }
    });
    return router;
}
function createCanvasArtifactRouter(getUserId, saveArtifact) {
    const router = express.Router();
    router.post("/", express.raw({ type: () => true, limit: `${MAX_ARTIFACT_BYTES + 1024 * 1024}b` }), async (req, res) => {
        try {
            const contentType = String(req.headers["content-type"] || "");
            if (!contentType.toLowerCase().includes("multipart/form-data"))
                return void res.status(400).json({ error: "请使用 multipart/form-data 上传素材" });
            const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
            const request = new globalThis.Request("http://gateway.local/v1/canvas-artifacts", { method: "POST", headers: { "content-type": contentType }, body: raw });
            const form = await request.formData();
            const canvasId = stringValue(form.get("canvasId")).trim();
            const file = form.get("file");
            if (!canvasId)
                return void res.status(400).json({ error: "canvasId 必填" });
            if (!(file instanceof File))
                return void res.status(400).json({ error: "file 必填" });
            if (!isAllowedMediaType(file.type))
                return void res.status(415).json({ error: "只允许上传图片、视频或音频素材" });
            if (file.size <= 0 || file.size > MAX_ARTIFACT_BYTES)
                return void res.status(413).json({ error: "素材大小必须在 100MB 以内" });
            const bytes = Buffer.from(await file.arrayBuffer());
            const checksum = createHash("sha256").update(bytes).digest("hex");
            const artifact = await saveArtifact(getUserId(res), canvasId, file, bytes, checksum);
            res.status(201).json({ data: artifact });
        }
        catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : "素材上传失败" });
        }
    });
    return router;
}
export function isOwnedCanvasArtifactPath(userId, canvasId, path) {
    if (!path || path.includes("..") || path.includes("\\"))
        return false;
    return new RegExp(`^${escapeRegExp(encodeURIComponent(userId))}/canvas/${escapeRegExp(encodeURIComponent(canvasId))}/(?:inputs|outputs)/`).test(path);
}
export function canvasArtifactStoragePath(uri) {
    return uri.startsWith("canvas-artifact:") && !uri.startsWith("canvas-artifact:local/") ? uri.slice("canvas-artifact:".length) : "";
}
function isAllowedMediaType(mimeType) {
    return mimeType.startsWith("image/") || mimeType.startsWith("video/") || mimeType.startsWith("audio/");
}
function stringValue(value) {
    return typeof value === "string" ? value : "";
}
function safeFileName(value) {
    return value.replace(/[^A-Za-z0-9._-]+/g, "-").slice(-100) || "artifact.bin";
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
//# sourceMappingURL=canvas-artifact-routes.js.map