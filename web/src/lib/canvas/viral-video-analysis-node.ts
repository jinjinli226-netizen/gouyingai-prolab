import { CanvasNodeType, type CanvasNodeData, type CanvasNodeMetadata, type Position, type ViralVideoShotFrame } from "@/types/canvas";
import { formatViralVideoAnalysisSummary, type ViralVideoAnalysis } from "./viral-video-remake-workflow";

export const VIRAL_VIDEO_ANALYSIS_NODE_SIZE = {
    width: 1320,
    height: 760,
} as const;

export type ViralVideoAnalysisNodeInput = {
    id: string;
    title: string;
    position: Position;
    analysis: ViralVideoAnalysis;
    analysisPrompt: string;
    shotFrames?: ViralVideoShotFrame[];
};

export async function hydrateViralVideoShotFrames(
    shotFrames: ViralVideoShotFrame[],
    resolveStoredImage: (storageKey: string) => Promise<string>,
): Promise<ViralVideoShotFrame[]> {
    return Promise.all(
        shotFrames.map(async (frame) => {
            if (!frame.storageKey) return frame;
            const content = await resolveStoredImage(frame.storageKey);
            return { ...frame, content: content || undefined };
        }),
    );
}

export function buildViralVideoAnalysisNode({ id, title, position, analysis, analysisPrompt, shotFrames = [] }: ViralVideoAnalysisNodeInput): CanvasNodeData {
    return {
        id,
        type: CanvasNodeType.Text,
        title,
        position,
        width: VIRAL_VIDEO_ANALYSIS_NODE_SIZE.width,
        height: VIRAL_VIDEO_ANALYSIS_NODE_SIZE.height,
        metadata: {
            content: formatViralVideoAnalysisSummary(analysis, analysisPrompt),
            prompt: analysisPrompt,
            status: "success",
            fontSize: 14,
            viralVideoAnalysis: analysis,
            viralVideoShotFrames: shotFrames,
        },
    };
}

export function buildViralVideoAnalyzedWorkflowPatch(analysisNodeId: string) {
    return { analysisNodeId };
}
