import { imageToDataUrl } from "@/services/image-storage";
import { mediaToDataUrl } from "@/services/file-storage";
import type { AiTextContentPart } from "@/services/api/image";
import { CanvasNodeType, type CanvasAssistantReference, type CanvasNodeData } from "@/types/canvas";

export function nodeToAssistantReference(node: CanvasNodeData): CanvasAssistantReference | null {
    if (node.type === CanvasNodeType.Image && node.metadata?.content) {
        return { id: node.id, type: node.type, title: node.title, dataUrl: node.metadata.content, storageKey: node.metadata.storageKey, mimeType: node.metadata.mimeType || "image/png" };
    }
    if (node.type === CanvasNodeType.Video && node.metadata?.content) {
        return { id: node.id, type: node.type, title: node.title, dataUrl: node.metadata.content, storageKey: node.metadata.storageKey, mimeType: node.metadata.mimeType || "video/mp4" };
    }
    if (node.type === CanvasNodeType.Text && node.metadata?.content) {
        return { id: node.id, type: node.type, title: node.title, text: node.metadata.content };
    }
    return null;
}

export function buildAssistantReferences(nodes: CanvasNodeData[], selectedNodeIds: Set<string>) {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    return Array.from(selectedNodeIds)
        .map((id) => nodeById.get(id))
        .filter((node): node is CanvasNodeData => Boolean(node))
        .map(nodeToAssistantReference)
        .filter((item): item is CanvasAssistantReference => Boolean(item));
}

export async function assistantReferencesToContent(references: CanvasAssistantReference[]): Promise<AiTextContentPart[]> {
    const textParts: AiTextContentPart[] = references.flatMap((item) => (item.text ? [{ type: "text", text: `选中节点 ${item.title}：${item.text}` }] : []));
    const mediaParts = await Promise.all(
        references.map(async (item): Promise<AiTextContentPart | null> => {
            if (!item.dataUrl) return null;
            if (item.type === CanvasNodeType.Video) {
                const url = await mediaToDataUrl({ url: item.dataUrl, storageKey: item.storageKey, mimeType: item.mimeType || "video/mp4" });
                return url ? { type: "video_url", video_url: { url } } : null;
            }
            if (item.type === CanvasNodeType.Image) {
                const url = await imageToDataUrl(item);
                return url ? { type: "image_url", image_url: { url } } : null;
            }
            return null;
        }),
    );
    return [...textParts, ...mediaParts.filter((item): item is AiTextContentPart => Boolean(item))];
}
