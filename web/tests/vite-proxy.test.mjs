import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { loadConfigFromFile } from "vite";
import { browserProxyBaseUrl } from "../src/lib/pro-spec/constants.ts";

test("Vite registers the GouYingAi local upstream proxy plugin", async () => {
    const loaded = await loadConfigFromFile({ command: "serve", mode: "development" }, "vite.config.ts");
    assert.ok(loaded);

    const pluginNames = (loaded.config.plugins || []).map((plugin) => plugin?.name).filter(Boolean);
    assert.ok(pluginNames.includes("gouyingai-local-upstream-proxy"), `plugins: ${pluginNames.join(", ")}`);
    const viteConfig = readConfigSource();
    assert.match(viteConfig, /\/__gouyingai_upstream\//);
    assert.doesNotMatch(viteConfig, /__qzelynth_upstream/);
});

test("browser proxy keeps local gateway addresses direct and proxies external upstreams", () => {
    globalThis.window = { location: { hostname: "127.0.0.1", origin: "http://127.0.0.1:4173" } };
    try {
        assert.equal(browserProxyBaseUrl("http://127.0.0.1:8788"), "http://127.0.0.1:8788");
        assert.equal(browserProxyBaseUrl("http://localhost:8788"), "http://localhost:8788");
        assert.equal(browserProxyBaseUrl("https://aiapi.qzelynth.top"), "http://127.0.0.1:4173/__gouyingai_upstream/https%3A%2F%2Faiapi.qzelynth.top");
    } finally {
        delete globalThis.window;
    }
});

function readConfigSource() {
    return readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");
}
