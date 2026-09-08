import { CanvasNodeType, type CanvasNodeData, type Position } from "@/types/canvas";
import type { ViralBatchRecipe } from "./viral-video-domain";

export function buildViralVideoBatchNode(id: string, position: Position, recipe: ViralBatchRecipe): CanvasNodeData {
    return { id, type: CanvasNodeType.Config, title: "批量生产", position, width: 620, height: 360, metadata: { status: "idle", viralVideoBatchRecipe: recipe } };
}

export function buildViralVideoResultsNode(id: string, position: Position): CanvasNodeData {
    return { id, type: CanvasNodeType.Config, title: "成片结果库", position, width: 720, height: 420, metadata: { status: "idle", viralVideoResultsBatchId: undefined } };
}
