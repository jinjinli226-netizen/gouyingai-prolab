import assert from "node:assert/strict";
import test from "node:test";

import { prepareExternalCanvasRun, resolveExternalRunOutput } from "../src/lib/canvas/canvas-external-runs.ts";

const project = {
    id: "TEMPLATE",
    title: "情感纪念型3D手办带货",
    nodes: [
        { id: "product", type: "text", metadata: { contractRole: "input", inputKey: "product_name", required: true, content: "母版占位" } },
        { id: "runner", type: "config", metadata: { contractRole: "output", outputKey: "video", required: true, runOnStart: true, status: "idle" } },
    ],
    connections: [],
};

test("prepares an isolated project, maps reviewed inputs, and leaves the template unchanged", () => {
    const prepared = prepareExternalCanvasRun(project, { runId: "RUN-12345678", templateCanvasId: "TEMPLATE", inputs: { product_name: "3D手办" } });

    assert.equal(prepared.project.nodes[0].metadata.content, "3D手办");
    assert.equal(prepared.project.nodes[0].metadata.inputValue, "3D手办");
    assert.deepEqual(prepared.runnerIds, ["runner"]);
    assert.match(prepared.project.title, /RUN-1234/);
    assert.equal(project.nodes[0].metadata.content, "母版占位");
});

test("rejects a mismatched or non-runnable template before navigation", () => {
    assert.throws(() => prepareExternalCanvasRun(project, { runId: "RUN-X", templateCanvasId: "OTHER", inputs: { product_name: "A" } }), /母版/);
    assert.throws(() => prepareExternalCanvasRun({ ...project, nodes: project.nodes.slice(0, 1) }, { runId: "RUN-X", templateCanvasId: "TEMPLATE", inputs: { product_name: "A" } }), /运行节点|输出节点/);
});

test("returns download metadata only after a media URL is resolved", () => {
    const metadata = resolveExternalRunOutput({ id: "video", type: "video", metadata: { storageKey: "video:abc", mimeType: "video/mp4", bytes: 88 } }, "http://127.0.0.1:3000/media/abc.mp4");
    assert.deepEqual(metadata, { url: "http://127.0.0.1:3000/media/abc.mp4", mimeType: "video/mp4", sizeBytes: 88 });
    assert.throws(() => resolveExternalRunOutput({ id: "video", type: "video", metadata: {} }, ""), /下载地址/);
});
