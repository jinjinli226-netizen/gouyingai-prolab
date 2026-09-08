import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";

describe("AI batch commerce entry page", () => {
    test("owns vertical scrolling inside the fixed-height user layout", async () => {
        const source = await readFile(path.join(process.cwd(), "src/pages/ecommerce/index.tsx"), "utf8");

        assert.match(source, /<main className="[^"]*h-full[^"]*overflow-y-auto[^"]*"/);
    });

    test("exposes the legacy and universal beta remake workflows", async () => {
        const source = await readFile(path.join(process.cwd(), "src/pages/ecommerce/index.tsx"), "utf8");

        assert.match(source, /爆款复刻/);
        assert.match(source, /buildViralVideoRemakeProject/);
        assert.match(source, /通用复刻 Beta/);
        assert.match(source, /buildUniversalRemakeBetaProject/);
        assert.match(source, /openUniversalRemakeWorkflow/);
        assert.doesNotMatch(source, /ecommerceWorkflowDefinitions/);
        assert.doesNotMatch(source, /buildEcommerceWorkflowProject/);
        assert.doesNotMatch(source, /buildProjectPosterWorkflowProject/);
        assert.doesNotMatch(source, /项目宣传海报/);
        assert.doesNotMatch(source, /AI 硬广|AI 视觉种草|AI 剧情带货|AI 痛点对比|AI 混剪解说/);
    });
});
