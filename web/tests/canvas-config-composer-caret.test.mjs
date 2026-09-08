import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("keeps the canvas prompt composer caret visible while editing", async () => {
    const source = await readFile(new URL("../src/components/canvas/canvas-config-composer.tsx", import.meta.url), "utf8");
    const editorStart = source.indexOf("contentEditable");
    const editorEnd = source.indexOf("onInput=", editorStart);
    const editorSource = source.slice(editorStart, editorEnd);

    assert.match(editorSource, /\bselect-text\b/);
    assert.match(editorSource, /caretColor:\s*theme\.node\.text/);
});
