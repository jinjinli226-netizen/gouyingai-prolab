import type { CanvasConnection, CanvasNodeData } from "../../types/canvas";

export type CanvasVisualStage = "inputs" | "white_model" | "direction" | "segment_1" | "segment_2" | "assembly";
export type CanvasVisualRole = "input" | "ai" | "review" | "asset" | "segment" | "output" | "guard";
export type CanvasVisualConnectionKind = "primary" | "related" | "dependency";

type CanvasColorTheme = "light" | "dark";
type StageStyle = { accent: string; soft: string; border: string };

const stageStyles: Record<CanvasColorTheme, Record<CanvasVisualStage, StageStyle>> = {
    light: {
        inputs: { accent: "#2563eb", soft: "rgba(37,99,235,.08)", border: "rgba(37,99,235,.38)" },
        white_model: { accent: "#7c3aed", soft: "rgba(124,58,237,.08)", border: "rgba(124,58,237,.38)" },
        direction: { accent: "#0891b2", soft: "rgba(8,145,178,.08)", border: "rgba(8,145,178,.38)" },
        segment_1: { accent: "#d97706", soft: "rgba(217,119,6,.08)", border: "rgba(217,119,6,.40)" },
        segment_2: { accent: "#ea580c", soft: "rgba(234,88,12,.08)", border: "rgba(234,88,12,.40)" },
        assembly: { accent: "#16a34a", soft: "rgba(22,163,74,.08)", border: "rgba(22,163,74,.40)" },
    },
    dark: {
        inputs: { accent: "#60a5fa", soft: "rgba(96,165,250,.11)", border: "rgba(96,165,250,.44)" },
        white_model: { accent: "#a78bfa", soft: "rgba(167,139,250,.11)", border: "rgba(167,139,250,.44)" },
        direction: { accent: "#22d3ee", soft: "rgba(34,211,238,.10)", border: "rgba(34,211,238,.42)" },
        segment_1: { accent: "#fbbf24", soft: "rgba(251,191,36,.10)", border: "rgba(251,191,36,.44)" },
        segment_2: { accent: "#fb923c", soft: "rgba(251,146,60,.10)", border: "rgba(251,146,60,.44)" },
        assembly: { accent: "#4ade80", soft: "rgba(74,222,128,.10)", border: "rgba(74,222,128,.44)" },
    },
};

const neutralStage: Record<CanvasColorTheme, StageStyle> = {
    light: { accent: "#78716c", soft: "rgba(120,113,108,.07)", border: "rgba(120,113,108,.32)" },
    dark: { accent: "#a8a29e", soft: "rgba(168,162,158,.10)", border: "rgba(168,162,158,.34)" },
};

const roleStyles: Record<CanvasVisualRole, { label: string; accent: string }> = {
    input: { label: "输入资料", accent: "#2563eb" },
    ai: { label: "AI", accent: "#7c3aed" },
    review: { label: "人工确认", accent: "#f59e0b" },
    asset: { label: "中间产物", accent: "#0891b2" },
    segment: { label: "片段", accent: "#ea580c" },
    output: { label: "最终产物", accent: "#16a34a" },
    guard: { label: "安全门", accent: "#dc2626" },
};

export function canvasVisualStageStyle(stage: unknown, theme: CanvasColorTheme): StageStyle {
    return typeof stage === "string" && stage in stageStyles[theme] ? stageStyles[theme][stage as CanvasVisualStage] : neutralStage[theme];
}

export function canvasVisualRoleStyle(role: unknown) {
    return typeof role === "string" && role in roleStyles ? roleStyles[role as CanvasVisualRole] : { label: "节点", accent: "#78716c" };
}

export function selectVisibleCanvasConnections(connections: CanvasConnection[], nodes: CanvasNodeData[], selectedNodeIds: Set<string>, showAllConnections: boolean) {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const hasPrimaryFlow = nodes.some((node) => Boolean(node.metadata?.primaryFlowNextIds?.length));
    return connections.flatMap((connection) => {
        const from = nodeById.get(connection.fromNodeId);
        const primary = Boolean(from?.metadata?.primaryFlowNextIds?.includes(connection.toNodeId));
        const related = selectedNodeIds.has(connection.fromNodeId) || selectedNodeIds.has(connection.toNodeId);
        if (hasPrimaryFlow && !showAllConnections && !primary && !related) return [];
        return [{ connection, kind: primary ? "primary" : related ? "related" : "dependency" } as const];
    });
}
