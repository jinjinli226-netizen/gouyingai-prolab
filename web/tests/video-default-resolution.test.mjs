import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("new video settings and the Gateway fallback default to 768p", async () => {
    const [storeSource, panelSource, gatewaySource] = await Promise.all([
        readFile(new URL("../src/stores/use-config-store.ts", import.meta.url), "utf8"),
        readFile(new URL("../src/components/video-settings-panel.tsx", import.meta.url), "utf8"),
        readFile(new URL("../../gateway/src/canvas-job-handlers/video-job-handler.ts", import.meta.url), "utf8"),
    ]);

    assert.match(storeSource, /vquality:\s*"768"/);
    assert.match(storeSource, /config\.vquality === "720" \? defaultConfig\.vquality/);
    assert.match(panelSource, /value:\s*"768",\s*label:\s*"768p"/);
    assert.match(panelSource, /return value\.replace\(\/p\$\/i, ""\) \|\| "768"/);
    assert.match(gatewaySource, /input\.resolution_name \|\| "768p"/);
});
