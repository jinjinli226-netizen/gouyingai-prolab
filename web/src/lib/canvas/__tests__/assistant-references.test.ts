import { describe, expect, test } from "bun:test";

import { assistantReferencesToContent, nodeToAssistantReference } from "../canvas-assistant-references";
import { toOpenAiChatMessages, type ResponseInputMessage } from "../../../services/api/image";
import { buildNodeResponseMessages } from "../../../components/canvas/canvas-node-generation";
import type { ReferenceVideo } from "../../../types/media";
import { CanvasNodeType, type CanvasNodeData } from "../../../types/canvas";

describe("canvas assistant media references", () => {
    test("includes a selected video node as an OpenAI video_url content block", async () => {
        const node: CanvasNodeData = {
            id: "video-1",
            type: CanvasNodeType.Video,
            title: "产品演示",
            position: { x: 0, y: 0 },
            width: 640,
            height: 360,
            metadata: {
                content: "https://cdn.example.com/demo.mp4",
                mimeType: "video/mp4",
            },
        };

        const reference = nodeToAssistantReference(node);
        expect(reference?.type).toBe(CanvasNodeType.Video);
        expect(reference?.mimeType).toBe("video/mp4");
        const content = await assistantReferencesToContent(reference ? [reference] : []);
        expect(content.some((item) => item.type === "video_url" && item.video_url.url === "https://cdn.example.com/demo.mp4")).toBe(true);
    });

    test("preserves video_url when converting assistant messages to OpenAI chat", () => {
        const messages: ResponseInputMessage[] = [
            {
                role: "user",
                content: [
                    { type: "text", text: "分析这个视频" },
                    { type: "video_url", video_url: { url: "data:video/mp4;base64,AAAA" } },
                ],
            },
        ];

        expect(JSON.stringify(toOpenAiChatMessages(messages))).toBe(JSON.stringify(messages));
    });

    test("includes upstream video references when generating a text response", () => {
        const video: ReferenceVideo = { id: "video-1", name: "demo.mp4", type: "video/mp4", url: "https://cdn.example.com/demo.mp4" };
        const [message] = buildNodeResponseMessages({ prompt: "总结视频", referenceImages: [], referenceVideos: [video], referenceAudios: [], textCount: 0, imageCount: 0, videoCount: 1, audioCount: 0 });
        expect(Array.isArray(message.content)).toBe(true);
        expect((message.content as Array<{ type: string }>).some((item) => item.type === "video_url")).toBe(true);
    });
});
