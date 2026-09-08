import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const visual = await import("../src/lib/canvas/canvas-visual-semantics.ts").catch(() => ({}));

const nodes = [
    { id: "input", metadata: { visualStage: "inputs", primaryFlowNextIds: ["review"] } },
    { id: "review", metadata: { visualStage: "white_model", visualRole: "review", primaryFlowNextIds: ["final"] } },
    { id: "detail", metadata: { visualStage: "direction", visualRole: "ai" } },
    { id: "final", metadata: { visualStage: "assembly", visualRole: "output" } },
];

const connections = [
    { id: "primary-1", fromNodeId: "input", toNodeId: "review" },
    { id: "primary-2", fromNodeId: "review", toNodeId: "final" },
    { id: "dependency-1", fromNodeId: "input", toNodeId: "detail" },
    { id: "dependency-2", fromNodeId: "detail", toNodeId: "final" },
];

test("maps controlled canvas stages and roles to readable semantic styles", () => {
    assert.equal(typeof visual.canvasVisualStageStyle, "function");
    assert.equal(typeof visual.canvasVisualRoleStyle, "function");
    assert.equal(visual.canvasVisualStageStyle("inputs", "light").accent, "#2563eb");
    assert.equal(visual.canvasVisualStageStyle("assembly", "dark").accent, "#4ade80");
    assert.deepEqual(visual.canvasVisualRoleStyle("review"), { label: "人工确认", accent: "#f59e0b" });
    assert.deepEqual(visual.canvasVisualRoleStyle("not-allowed"), { label: "节点", accent: "#78716c" });
});

test("shows only declared primary-flow connections by default", () => {
    const visible = visual.selectVisibleCanvasConnections?.(connections, nodes, new Set(), false) || [];
    assert.deepEqual(
        visible.map((item) => [item.connection.id, item.kind]),
        [
            ["primary-1", "primary"],
            ["primary-2", "primary"],
        ],
    );
});

test("adds exactly the selected nodes one-hop dependencies", () => {
    const visible = visual.selectVisibleCanvasConnections?.(connections, nodes, new Set(["input"]), false) || [];
    assert.deepEqual(
        visible.map((item) => [item.connection.id, item.kind]),
        [
            ["primary-1", "primary"],
            ["primary-2", "primary"],
            ["dependency-1", "related"],
        ],
    );
});

test("restores every logical dependency only in all-connections mode", () => {
    const visible = visual.selectVisibleCanvasConnections?.(connections, nodes, new Set(), true) || [];
    assert.equal(visible.length, connections.length);
    assert.deepEqual(
        visible.map((item) => item.kind),
        ["primary", "primary", "dependency", "dependency"],
    );
});

test("keeps every connection visible on legacy canvases without a primary-flow declaration", () => {
    const legacyNodes = nodes.map((node) => ({ ...node, metadata: {} }));
    const visible = visual.selectVisibleCanvasConnections?.(connections, legacyNodes, new Set(), false) || [];
    assert.equal(visible.length, connections.length);
    assert.deepEqual(visible.map((item) => item.kind), ["dependency", "dependency", "dependency", "dependency"]);
});

test("wires semantic groups, role badges, and the all-dependencies switch into the canvas UI", async () => {
    const [nodeSource, connectionSource, toolbarSource, projectSource] = await Promise.all([
        readFile(new URL("../src/components/canvas/canvas-node.tsx", import.meta.url), "utf8"),
        readFile(new URL("../src/components/canvas/canvas-connections.tsx", import.meta.url), "utf8"),
        readFile(new URL("../src/components/canvas/canvas-toolbar.tsx", import.meta.url), "utf8"),
        readFile(new URL("../src/pages/canvas/project.tsx", import.meta.url), "utf8"),
    ]);

    assert.match(nodeSource, /canvasVisualStageStyle/);
    assert.match(nodeSource, /canvasVisualRoleStyle/);
    assert.match(nodeSource, /data\.metadata\?\.visualRole/);
    assert.match(connectionSource, /CanvasVisualConnectionKind/);
    assert.match(toolbarSource, /showAllConnections/);
    assert.match(toolbarSource, /显示全部依赖/);
    assert.match(projectSource, /selectVisibleCanvasConnections/);
});
