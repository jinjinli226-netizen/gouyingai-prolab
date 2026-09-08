import assert from "node:assert/strict";
import test from "node:test";

test("video API errors expose a string error returned by the gateway", async () => {
    const videoApi = await import("../src/services/api/api-error.ts");

    assert.equal(typeof videoApi.readApiErrorMessage, "function");
    assert.equal(videoApi.readApiErrorMessage({ error: "AutoDL 参考图至少 1 张" }), "AutoDL 参考图至少 1 张");
});
