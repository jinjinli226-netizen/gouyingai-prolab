import { supabase } from "@/services/supabase-client";
import { resolveGatewayBaseUrl } from "@/services/gateway-url";

export const gatewayBaseUrl = resolveGatewayBaseUrl(import.meta.env.VITE_GATEWAY_URL || "");

export const isGatewayConfigured = Boolean(gatewayBaseUrl);

export type GatewayApiFormat = "openai" | "gemini" | "autodl_comfyui";

export type GatewayChannel = {
    id: string;
    name: string;
    base_url: string;
    api_format: GatewayApiFormat;
    key_ciphertext: string;
    enabled: boolean;
    created_at: string;
    updated_at: string;
};

export type GatewayModel = {
    id: string;
    channel_id: string;
    model_name: string;
    display_name: string;
    capability: "image" | "video" | "text" | "audio";
    api_format: GatewayApiFormat;
    published: boolean;
    sort_order: number;
    options: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    gouyingai_channels?: Pick<GatewayChannel, "name" | "base_url">;
};

export type GatewayUsage = {
    id: string;
    user_id: string;
    model_id: string | null;
    capability: string;
    status: string;
    tokens: number;
    created_at: string;
};

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
    let token = "";
    if (supabase) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token || "";
    }
    const response = await fetch(`${gatewayBaseUrl}${path}`, {
        ...init,
        headers: {
            "content-type": "application/json",
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            ...(init?.headers || {}),
        },
    });
    const body = (await response.json().catch(() => ({}))) as { data?: T; error?: string };
    if (!response.ok) throw new Error(body.error || `请求失败（${response.status}）`);
    return body.data as T;
}

export const gatewayAdminApi = {
    listChannels: () => adminFetch<GatewayChannel[]>("/admin/channels"),
    createChannel: (input: { name: string; base_url: string; api_format: GatewayApiFormat; api_key: string; enabled: boolean }) =>
        adminFetch<GatewayChannel>("/admin/channels", { method: "POST", body: JSON.stringify(input) }),
    updateChannel: (id: string, input: Partial<{ name: string; base_url: string; api_format: GatewayApiFormat; api_key: string; enabled: boolean }>) =>
        adminFetch<GatewayChannel>(`/admin/channels/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    deleteChannel: (id: string) => adminFetch<{ ok: true }>(`/admin/channels/${id}`, { method: "DELETE" }),

    listModels: () => adminFetch<GatewayModel[]>("/admin/models"),
    createModel: (input: Partial<GatewayModel> & { channel_id: string; model_name: string; display_name: string; capability: GatewayModel["capability"] }) =>
        adminFetch<GatewayModel>("/admin/models", { method: "POST", body: JSON.stringify(input) }),
    updateModel: (id: string, input: Partial<GatewayModel>) =>
        adminFetch<GatewayModel>(`/admin/models/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    deleteModel: (id: string) => adminFetch<{ ok: true }>(`/admin/models/${id}`, { method: "DELETE" }),

    listUsage: (limit = 200) => adminFetch<GatewayUsage[]>(`/admin/usage?limit=${limit}`),
};

export type GatewayCatalogModel = {
    id: string;
    bindingId: string;
    modelName: string;
    displayName: string;
    capability: GatewayModel["capability"];
    options: Record<string, unknown>;
    channelName?: string;
    channelBaseUrl?: string;
    channelId?: string;
};

export async function fetchGatewayCatalog(capability?: GatewayModel["capability"]) {
    const query = capability ? `?capability=${encodeURIComponent(capability)}&cacheBust=${Date.now()}` : `?cacheBust=${Date.now()}`;
    return adminFetch<GatewayCatalogModel[]>(`/v1/models${query}`, { cache: "no-store" });
}

export async function syncGatewayCatalog(fetchCatalog: () => Promise<GatewayCatalogModel[]>, applyCatalog: (catalog: GatewayCatalogModel[]) => void) {
    applyCatalog(await fetchCatalog());
}
