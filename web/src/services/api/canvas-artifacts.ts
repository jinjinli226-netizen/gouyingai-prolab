import { gatewayBaseUrl } from "@/services/gateway-admin";
import { supabase } from "@/services/supabase-client";

export type CanvasArtifact = {
    id: string;
    uri: string;
    name: string;
    mimeType: string;
    bytes: number;
    checksum: string;
};

export async function uploadCanvasArtifact(canvasId: string, media: Blob, name = "canvas-reference") {
    if (!gatewayBaseUrl) throw new Error("尚未配置 Gateway，不能上传后台任务素材");
    const form = new FormData();
    form.append("canvasId", canvasId);
    const file = media instanceof File ? media : new File([media], name, { type: media.type || "application/octet-stream" });
    form.append("file", file, file.name);
    let token = "";
    if (supabase) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token || "";
    }
    const response = await fetch(`${gatewayBaseUrl}/v1/canvas-artifacts`, {
        method: "POST",
        headers: token ? { authorization: `Bearer ${token}` } : undefined,
        body: form,
    });
    const body = (await response.json().catch(() => ({}))) as { data?: CanvasArtifact; error?: string };
    if (!response.ok || !body.data) throw new Error(body.error || `素材上传失败（${response.status}）`);
    return body.data;
}

export async function resolveCanvasArtifactUrl(canvasId: string, uri: string) {
    if (!gatewayBaseUrl) throw new Error("尚未配置 Gateway，不能读取后台任务素材");
    let token = "";
    if (supabase) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token || "";
    }
    const query = new URLSearchParams({ canvasId, uri });
    const response = await fetch(`${gatewayBaseUrl}/v1/canvas-artifacts/url?${query}`, { headers: token ? { authorization: `Bearer ${token}` } : undefined });
    const body = (await response.json().catch(() => ({}))) as { data?: { url?: string }; error?: string };
    if (!response.ok || !body.data?.url) throw new Error(body.error || `素材地址刷新失败（${response.status}）`);
    return body.data.url.startsWith("/") ? `${gatewayBaseUrl}${body.data.url}` : body.data.url;
}
