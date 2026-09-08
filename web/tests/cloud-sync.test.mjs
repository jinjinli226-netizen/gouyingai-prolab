import assert from "node:assert/strict";
import test from "node:test";

const cloud = await import("../src/lib/cloud-sync-utils.ts").catch(() => ({}));

test("enables cloud sync only when Supabase public configuration is complete", () => {
    assert.equal(cloud.isSupabaseConfigReady?.("https://example.supabase.co", "anon-key"), true);
    assert.equal(cloud.isSupabaseConfigReady?.("", "anon-key"), false);
    assert.equal(cloud.isSupabaseConfigReady?.("https://example.supabase.co", ""), false);
});

test("scopes media objects to the authenticated user", () => {
    assert.equal(cloud.supabaseMediaPath?.("user-123", "image:abc"), "user-123/image_abc");
    assert.equal(cloud.supabaseMediaPath?.("user-123", "../private"), "user-123/private");
});

test("keeps the newest record when local and cloud records conflict", () => {
    const local = { id: "one", updatedAt: "2026-08-01T01:00:00.000Z", value: "local" };
    const remote = { id: "one", updatedAt: "2026-08-01T00:00:00.000Z", value: "remote" };
    assert.deepEqual(cloud.newerRecord?.(local, remote), local);
    assert.deepEqual(cloud.newerRecord?.(remote, local), local);
});
