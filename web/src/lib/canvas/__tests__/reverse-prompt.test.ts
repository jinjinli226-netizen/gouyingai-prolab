import { describe, expect, test } from "bun:test";

import { reversePromptPreset, reversePromptReferenceLabel } from "../canvas-reverse-prompt";
import { CanvasNodeType } from "../../../types/canvas";

describe("canvas reverse prompt", () => {
    test("provides a video-specific reverse prompt", () => {
        expect(reversePromptReferenceLabel(CanvasNodeType.Video)).toBe("参考视频");
        expect(reversePromptPreset(CanvasNodeType.Video).includes("AI 视频生成")).toBe(true);
        expect(reversePromptPreset(CanvasNodeType.Video).includes("逐镜头分镜表")).toBe(true);
        expect(reversePromptPreset(CanvasNodeType.Video).includes("分镜条数由真实剪辑决定")).toBe(true);
        expect(reversePromptPreset(CanvasNodeType.Video).includes("至少 12 个")).toBe(false);
        expect(reversePromptPreset(CanvasNodeType.Video).includes("参考视频总时长")).toBe(false);
    });
});
