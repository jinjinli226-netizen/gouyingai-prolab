import assert from "node:assert/strict";
import test from "node:test";

import { CanvasRunRegistry } from "../src/canvas-runs.js";

const template = {
    projectId: "CANVAS-TEMPLATE",
    title: "情感纪念型3D手办带货",
    nodes: [
        { id: "product", type: "text" as const, position: { x: 0, y: 0 }, width: 320, height: 200, metadata: { contractRole: "input", inputKey: "product_name", dataType: "text", required: true } },
        { id: "video-runner", type: "config" as const, position: { x: 400, y: 0 }, width: 320, height: 200, metadata: { contractRole: "output", outputKey: "video", dataType: "video", materialRole: "video", required: true, runOnStart: true, status: "idle" } },
        { id: "copy-runner", type: "config" as const, position: { x: 400, y: 260 }, width: 320, height: 200, metadata: { contractRole: "output", outputKey: "copy", dataType: "text", materialRole: "copy", required: true, runOnStart: true, status: "idle" } },
    ],
    connections: [
        { id: "input-video", fromNodeId: "product", toNodeId: "video-runner" },
        { id: "input-copy", fromNodeId: "product", toNodeId: "copy-runner" },
    ],
};

test("dry-run validates the template without requesting a paid start", () => {
    const registry = new CanvasRunRegistry();
    const run = registry.create(template, { canvasId: "CANVAS-TEMPLATE", inputs: { product_name: "3D手办" }, dryRun: true });

    assert.equal(run.status, "dry_run_complete");
    assert.equal(registry.startEvent(run.runId), null);
});

test("rejects empty or incomplete templates before creating a real run", () => {
    const registry = new CanvasRunRegistry();

    assert.throws(
        () => registry.create({ projectId: "EMPTY", nodes: [], connections: [] }, { canvasId: "EMPTY", inputs: {}, dryRun: false }),
        /输入节点|输出节点|运行节点/,
    );
    assert.throws(
        () => registry.create(template, { canvasId: "CANVAS-TEMPLATE", inputs: {}, dryRun: false }),
        /product_name/,
    );
});

test("tracks an isolated run, multiple outputs, completion, and download metadata", () => {
    const registry = new CanvasRunRegistry();
    const created = registry.create(template, { canvasId: "CANVAS-TEMPLATE", inputs: { product_name: "3D手办" }, dryRun: false });
    const event = registry.startEvent(created.runId);

    assert.equal(event?.templateCanvasId, "CANVAS-TEMPLATE");
    assert.deepEqual(event?.inputs, { product_name: "3D手办" });
    assert.equal(registry.acknowledgeStart(created.runId, "CANVAS-RUN-1").status, "running");

    registry.updateCanvas({
        ...template,
        projectId: "CANVAS-RUN-1",
        nodes: [
            ...template.nodes.map((node) => ({ ...node, metadata: { ...node.metadata, status: "success" } })),
            { id: "video-1", type: "video", position: { x: 800, y: 0 }, width: 320, height: 200, metadata: { status: "success", content: "http://127.0.0.1:3000/media/video-1.mp4", mimeType: "video/mp4", bytes: 1234 } },
            { id: "copy-1", type: "text", position: { x: 800, y: 260 }, width: 320, height: 200, metadata: { status: "success", content: "纪念不只是回忆。", mimeType: "text/plain" } },
        ],
        connections: [
            ...template.connections,
            { id: "video-output", fromNodeId: "video-runner", toNodeId: "video-1" },
            { id: "copy-output", fromNodeId: "copy-runner", toNodeId: "copy-1" },
        ],
    });

    assert.equal(registry.get(created.runId).status, "completed");
    const outputs = registry.listOutputs(created.runId);
    assert.deepEqual(outputs.map((output) => output.type).sort(), ["text", "video"]);
    const video = outputs.find((output) => output.type === "video");
    assert.ok(video);
    assert.deepEqual(registry.download(created.runId, video.id), {
        outputId: video.id,
        url: "http://127.0.0.1:3000/media/video-1.mp4",
        mimeType: "video/mp4",
        sizeBytes: 1234,
    });
});

test("a failed required output fails only that run and cancellation is terminal", () => {
    const registry = new CanvasRunRegistry();
    const failed = registry.create(template, { canvasId: "CANVAS-TEMPLATE", inputs: { product_name: "A" }, dryRun: false });
    registry.startEvent(failed.runId);
    registry.acknowledgeStart(failed.runId, "CANVAS-RUN-FAILED");
    registry.updateCanvas({
        ...template,
        projectId: "CANVAS-RUN-FAILED",
        nodes: template.nodes.map((node) => node.id === "video-runner" ? { ...node, metadata: { ...node.metadata, status: "error", errorDetails: "provider failed" } } : node),
    });
    assert.equal(registry.get(failed.runId).status, "failed");
    assert.match(registry.get(failed.runId).error || "", /provider failed/);

    const cancelled = registry.create(template, { canvasId: "CANVAS-TEMPLATE", inputs: { product_name: "B" }, dryRun: false });
    registry.startEvent(cancelled.runId);
    assert.equal(registry.cancel(cancelled.runId).status, "cancelled");
    assert.equal(registry.acknowledgeStart(cancelled.runId, "LATE").status, "cancelled");
});
