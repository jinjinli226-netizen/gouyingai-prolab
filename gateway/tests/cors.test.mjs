import assert from "node:assert/strict";
import test from "node:test";

const corsModule = await import("../src/cors.ts");

test("production CORS accepts only configured exact origins", () => {
  const allowed = new Set(["https://app.example.com"]);
  assert.equal(corsModule.isAllowedGatewayOrigin("https://app.example.com/", allowed, false), true);
  assert.equal(corsModule.isAllowedGatewayOrigin("https://evil.example.com", allowed, false), false);
  assert.equal(corsModule.isAllowedGatewayOrigin("http://localhost:3000", allowed, false), false);
});

test("local mode additionally accepts loopback and private LAN browser origins", () => {
  assert.equal(corsModule.isAllowedGatewayOrigin("http://127.0.0.1:3000", new Set(), true), true);
  assert.equal(corsModule.isAllowedGatewayOrigin("http://localhost:5173", new Set(), true), true);
  assert.equal(corsModule.isAllowedGatewayOrigin("http://192.168.1.20:3000", new Set(), true), true);
  assert.equal(corsModule.isAllowedGatewayOrigin("http://172.16.4.8:3000", new Set(), true), true);
  assert.equal(corsModule.isAllowedGatewayOrigin("http://10.0.0.8:3000", new Set(), true), true);
  assert.equal(corsModule.isAllowedGatewayOrigin("http://192.168.1.20.evil.example:3000", new Set(), true), false);
});
