import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const gatewayUrlModule = await import("../src/services/gateway-url.ts").catch(() => ({}));

test("local Gateway URL follows the browser host when the configured private IP becomes stale", () => {
    const resolveGatewayBaseUrl = gatewayUrlModule.resolveGatewayBaseUrl || (() => "");
    assert.equal(resolveGatewayBaseUrl("http://192.168.1.8:8788", "http://192.168.31.135:3000"), "http://192.168.31.135:8788");
    assert.equal(resolveGatewayBaseUrl("http://127.0.0.1:8788", "http://192.168.31.135:3000"), "http://192.168.31.135:8788");
    assert.equal(resolveGatewayBaseUrl("https://gateway.example.com", "https://app.example.com"), "https://gateway.example.com");
});

test("Gateway admin uses the runtime URL resolver", async () => {
    const source = await readFile(new URL("../src/services/gateway-admin.ts", import.meta.url), "utf8");
    assert.match(source, /resolveGatewayBaseUrl/);
});
