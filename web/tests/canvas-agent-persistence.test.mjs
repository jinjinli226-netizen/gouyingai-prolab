import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const projectSource = readFileSync(new URL("../src/pages/canvas/project.tsx", import.meta.url), "utf8");

test("keeps a headless Canvas Agent bridge mounted after the visible panel closes", () => {
    assert.match(
        projectSource,
        /!assistantMounted\s*&&\s*\(codexCompactAgent\s*\|\|\s*localAgentEnabled\)\s*\?\s*<CanvasLocalAgentPanel\s+headless/,
    );
});
