import { describe, expect, test } from "bun:test";

import { resolveVideoTaskRequestConfig } from "@/services/api/video";
import type { AiConfig } from "@/stores/use-config-store";

describe("video task routing", () => {
    test("resolves a legacy task model only inside the video capability", () => {
        const config = {
            channels: [{ id: "image", name: "Image", baseUrl: "https://image.example.com", apiKey: "sk-image", apiFormat: "openai" as const, models: ["gpt-image-2"] }],
            models: ["image::gpt-image-2"],
            model: "",
            imageModel: "image::gpt-image-2",
            videoModel: "",
            textModel: "",
            audioModel: "",
            imageModels: ["image::gpt-image-2"],
            videoModels: [],
            textModels: [],
            audioModels: [],
        } as unknown as AiConfig;

        let errorMessage = "";
        try {
            resolveVideoTaskRequestConfig(config, "image::gpt-image-2");
        } catch (error) {
            errorMessage = error instanceof Error ? error.message : String(error);
        }
        expect(errorMessage.includes("not configured for video")).toBe(true);
    });
});
