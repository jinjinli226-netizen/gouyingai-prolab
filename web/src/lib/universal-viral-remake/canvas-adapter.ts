import type { CanvasProject } from "../../stores/canvas/use-canvas-store";
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData, type UniversalRemakeBetaWorkflowState } from "../../types/canvas";

const CARD_SIZE = { width: 440, height: 560 };
const CARD_GAP = 90;

type UniversalRemakeBetaProject = Pick<CanvasProject, "title" | "nodes" | "connections" | "viewport"> & { workflow: UniversalRemakeBetaWorkflowState };

export function buildUniversalRemakeBetaProject(idFactory: () => string = defaultIdFactory): UniversalRemakeBetaProject {
    const roles = ["reference", "bindings", "template", "run", "results"] as const;
    const titles = ["1 · 参考视频与证据", "2 · 对象识别与替换", "3 · 已校验复刻母版", "4 · 批量与长视频计划", "5 · 完整成片结果"];
    const nodes: CanvasNodeData[] = roles.map((role, index) => ({
        id: idFactory(), type: CanvasNodeType.Text, title: titles[index],
        position: { x: 180 + index * (CARD_SIZE.width + CARD_GAP), y: 220 }, ...CARD_SIZE,
        metadata: { universalRemakeCard: { role }, content: "" },
    }));
    const connections: CanvasConnection[] = nodes.slice(0, -1).map((node, index) => ({ id: idFactory(), fromNodeId: node.id, toNodeId: nodes[index + 1].id }));
    const workflow: UniversalRemakeBetaWorkflowState = {
        kind: "universal-viral-remake-beta", phase: "idle",
        referenceNodeId: nodes[0].id, bindingsNodeId: nodes[1].id, templateNodeId: nodes[2].id, runNodeId: nodes[3].id, resultsNodeId: nodes[4].id,
        candidateCount: 1, maxInFlight: 2, maxSegmentDurationSeconds: 15,
        sourceReferenceAssetIds: [], replacements: [], replacementAssets: [], explicitBindings: [], variableSlots: [],
    };
    return { title: "通用复刻 Beta", nodes, connections, workflow, viewport: { x: 20, y: 80, k: 0.72 } };
}

export function attachUniversalRemakeReference(project: UniversalRemakeBetaProject, sourceNode: CanvasNodeData): UniversalRemakeBetaProject {
    const referenceNode = project.nodes.find((node) => node.id === project.workflow.referenceNodeId);
    if (!referenceNode) return project;
    const nextReference: CanvasNodeData = {
        ...referenceNode, type: CanvasNodeType.Video, title: sourceNode.title, width: Math.max(referenceNode.width, sourceNode.width),
        metadata: { ...sourceNode.metadata, universalRemakeCard: { role: "reference" } },
    };
    return { ...project, nodes: project.nodes.map((node) => node.id === referenceNode.id ? nextReference : node) };
}

let sequence = 0;
function defaultIdFactory() {
    sequence += 1;
    return `universal-remake-${Date.now().toString(36)}-${sequence.toString(36)}`;
}
