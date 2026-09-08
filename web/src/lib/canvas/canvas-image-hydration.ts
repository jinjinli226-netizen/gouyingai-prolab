export type CanvasImageSource = {
    canvasId: string;
    storageKey?: string;
    content?: string;
};

export type CanvasImageSourceResolvers = {
    resolveStoredImage: (storageKey: string, fallback: string) => Promise<string>;
    resolveCanvasArtifact: (canvasId: string, storageKey: string) => Promise<string>;
};

export async function resolveCanvasImageContent(source: CanvasImageSource, resolvers: CanvasImageSourceResolvers) {
    const content = source.content || "";
    const storageKey = source.storageKey || "";
    if (!storageKey) return content;
    if (storageKey.startsWith("canvas-artifact:")) {
        try {
            return (await resolvers.resolveCanvasArtifact(source.canvasId, storageKey)) || content;
        } catch {
            return content;
        }
    }
    if (storageKey.startsWith("image:")) return resolvers.resolveStoredImage(storageKey, content);
    return content;
}

export function shouldRefreshCanvasArtifactUrl(storageKey: string, content: string) {
    return storageKey.startsWith("canvas-artifact:local/") || (storageKey.startsWith("canvas-artifact:") && signedUrlExpiresSoon(content));
}

function signedUrlExpiresSoon(url: string) {
    try {
        const token = new URL(url).searchParams.get("token");
        if (!token) return false;
        const payload = token.split(".")[1];
        if (!payload) return true;
        const normalized = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
        const expiresAt = Number(JSON.parse(atob(normalized)).exp) * 1000;
        return !Number.isFinite(expiresAt) || expiresAt <= Date.now() + 60 * 60 * 1000;
    } catch {
        return true;
    }
}
