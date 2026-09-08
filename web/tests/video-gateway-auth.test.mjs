import assert from "node:assert/strict";
import test from "node:test";

import { videoRequestNeedsClientApiKey } from "../src/services/api/video-auth.ts";

test("gateway video requests do not require the server-owned API key in the browser", () => {
    assert.equal(videoRequestNeedsClientApiKey("http://127.0.0.1:8788", "http://127.0.0.1:8788"), false);
});

test("direct video requests still require a browser API key", () => {
    assert.equal(videoRequestNeedsClientApiKey("https://newapi.example.com/v1", "http://127.0.0.1:8788"), true);
});
