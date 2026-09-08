import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";

import {
    buildViralVideoRemakeActivation,
    getViralVideoRemakePrimaryAction,
} from "../src/lib/canvas/viral-video-remake-workflow.ts";

describe("native viral video remake activation", () => {
    const sourceVideo = {
        id: "source-video",
        type: "video",
        title: "reference.mp4",
        position: { x: 500, y: 240 },
        width: 236,
        height: 420,
        metadata: { content: "blob:reference", storageKey: "video-key", mimeType: "video/mp4", status: "success" },
    };

    test("activates the workflow around a selected uploaded video without removing existing canvas nodes", () => {
        const note = {
            id: "note",
            type: "text",
            title: "保留节点",
            position: { x: 0, y: 0 },
            width: 320,
            height: 240,
            metadata: { content: "keep me" },
        };

        const result = buildViralVideoRemakeActivation([note, sourceVideo], sourceVideo.id);

        assert.equal(result.workflow.kind, "viral-video-remake");
        assert.equal(result.workflow.sourceVideoNodeId, sourceVideo.id);
        assert.equal(result.workflow.phase, "idle");
        assert.equal(result.nodes.find((node) => node.id === note.id)?.metadata?.content, "keep me");
        const replacement = result.nodes.find((node) => node.id === result.workflow.replacementNodeId);
        assert.ok(replacement);
        assert.equal(replacement.type, "config");
        assert.ok(replacement.metadata?.viralVideoReplacementLibrary);
        assert.match(replacement.title, /替换元素/);
    });

    test("does not create a second replacement placeholder when activating the same workflow again", () => {
        const first = buildViralVideoRemakeActivation([sourceVideo], sourceVideo.id);
        const second = buildViralVideoRemakeActivation(first.nodes, sourceVideo.id, first.workflow);

        assert.equal(second.workflow.replacementNodeId, first.workflow.replacementNodeId);
        assert.equal(second.nodes.length, first.nodes.length);
    });

    test("rejects activation when the selected node is not an uploaded video", () => {
        assert.throws(
            () => buildViralVideoRemakeActivation([{ ...sourceVideo, type: "image" }], sourceVideo.id),
            /请选择已上传的视频节点/,
        );
    });
});

describe("native viral video remake primary action", () => {
    test("maps workflow phases to analysis, plan-and-generate, and direct generation", () => {
        assert.equal(getViralVideoRemakePrimaryAction("idle"), "analyze");
        assert.equal(getViralVideoRemakePrimaryAction("requirements_ready"), "plan-and-generate");
        assert.equal(getViralVideoRemakePrimaryAction("template_ready"), "generate");
    });
});

describe("native viral video remake integration", () => {
    test("exposes a viral-remake button on every canvas toolbar", async () => {
        const toolbarSource = await readFile(path.join(process.cwd(), "src/components/canvas/canvas-toolbar.tsx"), "utf8");
        const projectSource = await readFile(path.join(process.cwd(), "src/pages/canvas/project.tsx"), "utf8");

        assert.match(toolbarSource, /onOpenViralVideoRemake/);
        assert.match(toolbarSource, /label="爆款复刻"/);
        assert.match(projectSource, /onOpenViralVideoRemake=\{activateViralVideoRemake\}/);
    });

    test("chains successful prompt planning into exactly one automatic video launch", async () => {
        const barSource = await readFile(path.join(process.cwd(), "src/components/canvas/viral-video-remake-canvas-bar.tsx"), "utf8");
        const projectSource = await readFile(path.join(process.cwd(), "src/pages/canvas/project.tsx"), "utf8");

        assert.match(barSource, /一键生成复刻视频/);
        assert.match(barSource, /完整候选视频数/);
        assert.match(barSource, /max=\{1000\}/);
        assert.match(projectSource, /const planCount = 1/);
        assert.match(projectSource, /viralAutoGenerateAfterPlanningRef/);
        assert.match(projectSource, /handleGenerateViralRemake/);
        assert.match(projectSource, /viralAutoGenerateAfterPlanningRef\.current = null;[\s\S]*?void generateViralRemakeVideos\(\);/);
    });
});
