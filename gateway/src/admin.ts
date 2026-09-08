import type { Router } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";

import { encryptSecret, maskSecret } from "./encryption.js";

export function registerAdminRoutes(router: Router, admin: SupabaseClient) {
    router.get("/admin/channels", async (_req, res) => {
        const { data, error } = await admin.from("gouyingai_channels").select("*").order("created_at");
        if (error) return void res.status(500).json({ error: error.message });
        res.json({ data: (data || []).map((channel) => ({ ...channel, key_ciphertext: maskSecret(channel.key_ciphertext || "") })) });
    });

    router.post("/admin/channels", async (req, res) => {
        const { name, base_url, api_format = "openai", api_key = "", enabled = true } = req.body || {};
        if (!String(name || "").trim() || !String(base_url || "").trim()) return void res.status(400).json({ error: "渠道名称和 Base URL 必填" });
        const key_ciphertext = api_key ? encryptSecret(String(api_key)) : "";
        const { data, error } = await admin
            .from("gouyingai_channels")
            .insert({ name: String(name).trim(), base_url: String(base_url).trim(), api_format, key_ciphertext, enabled: Boolean(enabled) })
            .select()
            .single();
        if (error) return void res.status(500).json({ error: error.message });
        res.json({ data: { ...data, key_ciphertext: maskSecret(data.key_ciphertext || "") } });
    });

    router.patch("/admin/channels/:id", async (req, res) => {
        const { data: existing } = await admin.from("gouyingai_channels").select("key_ciphertext").eq("id", req.params.id).maybeSingle();
        const patch: Record<string, unknown> = {};
        if (req.body?.name) patch.name = String(req.body.name).trim();
        if (req.body?.base_url) patch.base_url = String(req.body.base_url).trim();
        if (req.body?.api_format) patch.api_format = req.body.api_format;
        if (typeof req.body?.enabled === "boolean") patch.enabled = req.body.enabled;
        if (req.body?.api_key) patch.key_ciphertext = encryptSecret(String(req.body.api_key));
        const { data, error } = await admin.from("gouyingai_channels").update(patch).eq("id", req.params.id).select().single();
        if (error) return void res.status(500).json({ error: error.message });
        res.json({ data: { ...data, key_ciphertext: maskSecret(data.key_ciphertext || "") } });
    });

    router.delete("/admin/channels/:id", async (req, res) => {
        const { error } = await admin.from("gouyingai_channels").delete().eq("id", req.params.id);
        if (error) return void res.status(500).json({ error: error.message });
        res.json({ ok: true });
    });

    router.get("/admin/models", async (req, res) => {
        const { data, error } = await admin.from("gouyingai_models").select("*, gouyingai_channels(name, base_url)").order("sort_order");
        if (error) return void res.status(500).json({ error: error.message });
        res.json({ data: data || [] });
    });

    router.post("/admin/models", async (req, res) => {
        const { channel_id, model_name, display_name, capability, api_format = "openai", published = true, sort_order = 0, options = {} } = req.body || {};
        if (!channel_id || !String(model_name || "").trim() || !String(display_name || "").trim() || !capability) {
            return void res.status(400).json({ error: "渠道、模型名、展示名和能力必填" });
        }
        const { data, error } = await admin.from("gouyingai_models").insert({ channel_id, model_name: String(model_name).trim(), display_name: String(display_name).trim(), capability, api_format, published, sort_order, options }).select().single();
        if (error) return void res.status(500).json({ error: error.message });
        res.json({ data });
    });

    router.patch("/admin/models/:id", async (req, res) => {
        const { data, error } = await admin.from("gouyingai_models").update(req.body || {}).eq("id", req.params.id).select().single();
        if (error) return void res.status(500).json({ error: error.message });
        res.json({ data });
    });

    router.delete("/admin/models/:id", async (req, res) => {
        const { error } = await admin.from("gouyingai_models").delete().eq("id", req.params.id);
        if (error) return void res.status(500).json({ error: error.message });
        res.json({ ok: true });
    });

    router.get("/admin/usage", async (req, res) => {
        const limit = Math.min(Number(req.query.limit) || 100, 500);
        const { data, error } = await admin.from("gouyingai_usage").select("*").order("created_at", { ascending: false }).limit(limit);
        if (error) return void res.status(500).json({ error: error.message });
        res.json({ data: data || [] });
    });
}
