import { describe, expect, test } from "bun:test";

import { browserProxyBaseUrl } from "../constants";
import { buildRequest } from "../provider-adapter";
import { inferModelInfo } from "../model-inference";
import { getModelLogoById } from "../model-logo";
import { fetchProApiTokenUsage, proApiRootUrl, summarizeModelCategories } from "../proapi-usage";
import {
    mergeSuggestedModelOptions,
    modelCapabilityHeaders,
    modelConfiguredForCapability,
    modelOptionLabel,
    modelOptionName,
    modelOptionSearchText,
    modelOptionSourceLabel,
    modelOptionsFromChannels,
    normalizeModelOptionValue,
    normalizeRequestedModelOption,
    resolveModelRequestConfig,
    resolveModelRequestConfigForCapability,
    selectableModelsByCapability,
    useConfigStore,
    type AiConfig,
} from "../../../stores/use-config-store";

describe("pro-spec inference", () => {
    test("routes any external API base through the local upstream proxy", () => {
        const previousWindow = globalThis.window;
        Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { hostname: "127.0.0.1", origin: "http://127.0.0.1:4173" } } });
        try {
            expect(browserProxyBaseUrl("https://grok-relay.example.com/custom-api")).toBe("http://127.0.0.1:4173/__gouyingai_upstream/https%3A%2F%2Fgrok-relay.example.com/custom-api");
        } finally {
            Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
        }
    });

    test("infers OpenAI chat model", () => {
        const info = inferModelInfo("gpt-4o");
        expect(info.category).toBe("chat");
        expect(info.group).toBe("OpenAI");
        expect(info.apiFormat).toBe("openai-response");
    });

    test("recognizes separator-free Gemini flash model as vision chat", () => {
        const info = inferModelInfo("Gemini3.6flash");
        expect(info.category).toBe("chat");
        expect(info.group).toBe("Google");
        expect(info.capabilities.includes("vision")).toBe(true);
    });

    test("infers Grok image model", () => {
        const info = inferModelInfo("grok-imagine");
        expect(info.category).toBe("image");
        expect(info.group).toBe("xAI");
        expect(info.apiFormat).toBe("dalle");
    });

    test("infers Grok video models", () => {
        const openaiVideo = inferModelInfo("grok-imagine-video");
        expect(openaiVideo.category).toBe("video");
        expect(openaiVideo.group).toBe("xAI");
        expect(openaiVideo.apiFormat).toBe("openai-video");

        // grok-image-video：部分聚合商把图生视频模型命名为 image 而非 imagine，
        // 不能被宽泛的 /image/ 规则误判为图像（否则视频节点下拉框为空 → 误弹配置框）
        const imageVideo = inferModelInfo("grok-image-video");
        expect(imageVideo.category).toBe("video");
        expect(imageVideo.group).toBe("xAI");
        expect(imageVideo.apiFormat).toBe("openai-video");

        const chatVideo = inferModelInfo("grok-video-chat");
        expect(chatVideo.category).toBe("video");
        expect(chatVideo.group).toBe("xAI");
        expect(chatVideo.apiFormat).toBe("grok-video-chat");
    });

    test("keeps image-specific models on dalle-compatible image protocol", () => {
        const geminiImage = inferModelInfo("gemini-2.5-flash-image");
        expect(geminiImage.category).toBe("image");
        expect(geminiImage.apiFormat).toBe("dalle");

        const soraImage = inferModelInfo("sora_image");
        expect(soraImage.category).toBe("image");
        expect(soraImage.apiFormat).toBe("dalle");

        const hunyuanImage = inferModelInfo("hunyuan-image-v3");
        expect(hunyuanImage.category).toBe("image");
        expect(hunyuanImage.apiFormat).toBe("dalle");
        expect(hunyuanImage.capabilities.length).toBe(0);

        for (const modelId of ["grok-imagine-image-edit", "qwen-image-edit", "flux-kontext-pro"]) {
            const info = inferModelInfo(modelId);
            expect(info.category).toBe("image");
            expect(info.apiFormat).toBe("dalle");
        }
    });

    test("resolves model logo", () => {
        expect(getModelLogoById("claude-sonnet-4-20250514")).toBe("/models/claude.png");
    });
});

describe("pro-spec provider adapter", () => {
    test("parses successful HTTP business errors", async () => {
        const request = buildRequest({
            modelId: "grok-imagine",
            prompt: "studio",
            baseUrl: "https://newapi.prorisehub.com",
            apiKey: "sk-test",
        });
        const parsed = await request.parseResponse(new Response(JSON.stringify({ code: 400, msg: "quota exhausted" }), { status: 200 }));
        expect(parsed.error).toBe("quota exhausted");
    });

    test("builds Hunyuan Image as images generation request instead of chat", () => {
        const request = buildRequest({
            modelId: "hunyuan-image-v3",
            prompt: "studio",
            modelParams: { size: "1024x1024", quality: "high" },
            baseUrl: "https://newapi.prorisehub.com",
            apiKey: "sk-test",
        });
        expect(request.url).toBe("https://newapi.prorisehub.com/v1/images/generations");
        expect(request.init.method).toBe("POST");
        const body = JSON.parse(String(request.init.body)) as Record<string, unknown>;
        expect(body.model).toBe("hunyuan-image-v3");
        expect(body.size).toBe("1024x1024");
        expect(body.quality).toBe("high");
    });

    test("builds Agnes Image without LiteLLM-unsupported response_format", () => {
        const request = buildRequest({
            modelId: "agnes-image-2.1-flash",
            prompt: "studio",
            modelParams: { size: "1024x1024", quality: "high" },
            baseUrl: "https://newapi.prorisehub.com",
            apiKey: "sk-test",
        });
        expect(request.url).toBe("https://newapi.prorisehub.com/v1/images/generations");
        expect(request.init.method).toBe("POST");
        const body = JSON.parse(String(request.init.body)) as Record<string, unknown>;
        expect(body.model).toBe("agnes-image-2.1-flash");
        expect(body.prompt).toBe("studio");
        expect(body.n).toBe(1);
        expect(body.response_format).toBeUndefined();
        expect(body.size).toBeUndefined();
        expect(body.quality).toBeUndefined();
    });

    test("builds GPT Image with OpenAI-compatible size instead of relay-only fields", () => {
        const request = buildRequest({
            modelId: "gpt-image-1",
            prompt: "studio",
            modelParams: { aspectRatio: "1:1", quality: "hd" },
            baseUrl: "https://newapi.prorisehub.com",
            apiKey: "sk-test",
        });
        expect(request.url).toBe("https://newapi.prorisehub.com/v1/images/generations");
        expect(request.init.method).toBe("POST");
        const body = JSON.parse(String(request.init.body)) as Record<string, unknown>;
        expect(body.model).toBe("gpt-image-1");
        expect(body.size).toBe("1024x1024");
        expect(body.quality).toBe("high");
        expect(body.response_format).toBeUndefined();
        expect(body.aspect_ratio).toBeUndefined();
    });

    test("parses URL-only image responses", async () => {
        const request = buildRequest({
            modelId: "agnes-image-2.1-flash",
            prompt: "studio",
            baseUrl: "https://newapi.prorisehub.com",
            apiKey: "sk-test",
        });
        const parsed = await request.parseResponse(new Response(JSON.stringify({ data: [{ url: "https://example.com/image.png" }] }), { status: 200 }));
        expect(parsed.resourceUrl).toBe("https://example.com/image.png");
        expect(parsed.resources?.[0]).toBe("https://example.com/image.png");
    });

    test("builds image edit requests through images edits multipart", () => {
        const request = buildRequest({
            operation: "edit",
            modelId: "qwen-image-edit",
            prompt: "edit this",
            imageFiles: [new File(["image"], "reference.png", { type: "image/png" })],
            modelParams: { size: "1024x1024", negativePrompt: "blur" },
            baseUrl: "https://newapi.prorisehub.com",
            apiKey: "sk-test",
        });
        expect(request.url).toBe("https://newapi.prorisehub.com/v1/images/edits");
        expect(request.init.method).toBe("POST");
        expect(request.init.body instanceof FormData).toBe(true);
        const form = request.init.body as FormData;
        expect(form.get("model")).toBe("qwen-image-edit");
        expect(form.get("prompt")).toBe("edit this");
        expect(form.get("size")).toBe("1024x1024");
        expect(form.get("negative_prompt")).toBe("blur");
        expect(form.getAll("image").length).toBe(1);
    });

    test("uses image[] array field when editing with multiple reference images", () => {
        const request = buildRequest({
            operation: "edit",
            modelId: "gpt-image-2",
            prompt: "merge these",
            imageFiles: [new File(["a"], "ref1.png", { type: "image/png" }), new File(["b"], "ref2.png", { type: "image/png" })],
            baseUrl: "https://newapi.prorisehub.com",
            apiKey: "sk-test",
        });
        const form = request.init.body as FormData;
        // 多图必须走 image[] 数组字段，否则 newapi 网关返回 422
        expect(form.getAll("image[]").length).toBe(2);
        expect(form.getAll("image").length).toBe(0);
    });

    test("rejects masks for non-mask image edit models", () => {
        let errorMessage = "";
        try {
            buildRequest({
                operation: "edit",
                modelId: "qwen-image-edit",
                prompt: "edit this",
                imageFiles: [new File(["image"], "reference.png", { type: "image/png" })],
                mask: new File(["mask"], "mask.png", { type: "image/png" }),
                baseUrl: "https://newapi.prorisehub.com",
                apiKey: "sk-test",
            });
        } catch (error) {
            errorMessage = error instanceof Error ? error.message : "";
        }
        expect(errorMessage.includes("暂不支持蒙版编辑")).toBe(true);
    });

    test("builds Grok Imagine video as JSON with up to seven Data URI references", async () => {
        const request = buildRequest({
            modelId: "grok-imagine-video",
            prompt: "video",
            images: Array.from({ length: 8 }, (_, index) => `data:image/png;base64,ref-${index}`),
            modelParams: { duration: 10, size: "1280x720" },
            baseUrl: "https://newapi.prorisehub.com",
            apiKey: "sk-test",
        });
        const body = JSON.parse(String(request.init.body)) as { model?: string; prompt?: string; seconds?: number; size?: string; images?: string[] };
        expect(new Headers(request.init.headers).get("Content-Type")).toBe("application/json");
        expect(body.model).toBe("grok-imagine-video");
        expect(body.prompt).toBe("video");
        expect(body.seconds).toBe(10);
        expect(body.size).toBe("1280x720");
        expect(body.images?.length).toBe(7);
        const parsed = await request.parseResponse(new Response(JSON.stringify({ task_id: "task-grok" }), { status: 200 }));
        expect(parsed.resourceUrl).toBe("task-grok");
    });

    test("routes grok-image-video to the Grok video endpoint", () => {
        const request = buildRequest({
            modelId: "grok-image-video",
            prompt: "video",
            baseUrl: "https://newapi.prorisehub.com",
            apiKey: "sk-test",
        });
        expect(request.apiFormat).toBe("openai-video");
        expect(request.url).toBe("https://newapi.prorisehub.com/v1/videos");
        expect(request.init.method).toBe("POST");
        const body = JSON.parse(String(request.init.body)) as { model?: string; seconds?: number; size?: string; images?: string[] };
        expect(new Headers(request.init.headers).get("Content-Type")).toBe("application/json");
        expect(body.model).toBe("grok-image-video");
        expect(body.seconds).toBe(6);
        expect(body.images).toBe(undefined);
    });
});

describe("pro-spec ProAPI usage", () => {
    test("normalizes ProAPI root URL", () => {
        expect(proApiRootUrl("https://newapi.prorisehub.com/v1")).toBe("https://newapi.prorisehub.com");
        expect(proApiRootUrl("https://newapi.prorisehub.com/")).toBe("https://newapi.prorisehub.com");
    });

    test("summarizes model categories", () => {
        const summary = summarizeModelCategories(["hunyuan-image-v3", "grok-imagine-video", "gpt-4o"]);
        expect(summary.total).toBe(3);
        expect(summary.image).toBe(1);
        expect(summary.video).toBe(1);
        expect(summary.chat).toBe(1);
    });

    test("fetches token usage with sk API key", async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = (async (url, init) => {
            expect(String(url)).toBe("https://newapi.prorisehub.com/api/usage/token");
            expect(init?.method).toBe("GET");
            expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
            return new Response(
                JSON.stringify({
                    success: true,
                    data: {
                        name: "agent-managed",
                        total_granted: 100,
                        total_used: 12.34,
                        total_available: 87.66,
                        unlimited_quota: false,
                        model_limits_enabled: true,
                        model_limits: ["hunyuan-image-v3"],
                        expires_at: -1,
                    },
                }),
                { status: 200 },
            );
        }) as typeof fetch;

        try {
            const usage = await fetchProApiTokenUsage({
                baseUrl: "https://newapi.prorisehub.com/v1",
                apiKey: "sk-test",
            });
            expect(usage.totalAvailable).toBe(87.66);
            expect(usage.modelLimitsEnabled).toBe(true);
            expect(usage.modelLimits.length).toBe(1);
            expect(usage.modelLimits[0]).toBe("hunyuan-image-v3");
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});

describe("model channel routing", () => {
    test("keeps text requests on the selected text model when the global model is an image model", () => {
        const channels = [
            { id: "image", name: "Image", baseUrl: "https://image.example.com", apiKey: "sk-image", apiFormat: "openai" as const, models: ["gpt-image-2"] },
            { id: "text", name: "Text", baseUrl: "https://text.example.com", apiKey: "sk-text", apiFormat: "openai" as const, models: ["gemini-3.6-flash"] },
        ];
        const models = modelOptionsFromChannels(channels);
        const config = { channels, models, model: models[0], imageModel: models[0], videoModel: "", textModel: models[1], audioModel: "" } as AiConfig;

        const resolved = resolveModelRequestConfigForCapability(config, "text");

        expect(resolved.model).toBe("gemini-3.6-flash");
        expect(resolved.baseUrl).toBe("https://text.example.com");
        expect(resolved.apiKey).toBe("sk-text");
    });

    test("uses configured capability membership instead of a model name when validating a selection", () => {
        const channels = [{ id: "gateway", name: "Gateway", baseUrl: "https://gateway.example.com", apiKey: "sk-gateway", apiFormat: "openai" as const, models: ["custom-image-text", "custom-chat-renderer"] }];
        const models = modelOptionsFromChannels(channels);
        const config = { channels, models, model: "", imageModel: models[1], imageModels: [models[1]], videoModel: "", videoModels: [], textModel: models[0], textModels: [models[0]], audioModel: "", audioModels: [] } as AiConfig;

        expect(modelConfiguredForCapability(config, models[0], "text")).toBe(true);
        expect(modelConfiguredForCapability(config, models[0], "image")).toBe(false);
    });

    test("does not fall back to the global image model when a text model is missing", () => {
        const channels = [{ id: "image", name: "Image", baseUrl: "https://image.example.com", apiKey: "sk-image", apiFormat: "openai" as const, models: ["gpt-image-2"] }];
        const models = modelOptionsFromChannels(channels);
        const config = { channels, models, model: models[0], imageModel: models[0], videoModel: "", textModel: "", audioModel: "" } as AiConfig;

        let errorMessage = "";
        try {
            resolveModelRequestConfigForCapability(config, "text");
        } catch (error) {
            errorMessage = error instanceof Error ? error.message : String(error);
        }
        expect(errorMessage).toBe("No text model configured");
    });

    test("rejects a selected image model for text even when text options are empty", () => {
        const channels = [{ id: "image", name: "Image", baseUrl: "https://image.example.com", apiKey: "sk-image", apiFormat: "openai" as const, models: ["gpt-image-2"] }];
        const models = modelOptionsFromChannels(channels);
        const config = { channels, models, model: models[0], imageModel: models[0], videoModel: "", textModel: models[0], textModels: [], audioModel: "" } as AiConfig;

        let errorMessage = "";
        try {
            resolveModelRequestConfigForCapability(config, "text");
        } catch (error) {
            errorMessage = error instanceof Error ? error.message : String(error);
        }
        expect(errorMessage).toBe("Selected model is not configured for text");
    });

    test("rejects an unavailable capability model instead of routing it through the first channel", () => {
        const channels = [{ id: "image", name: "Image", baseUrl: "https://image.example.com", apiKey: "sk-image", apiFormat: "openai" as const, models: ["gpt-image-2"] }];
        const config = { channels, models: modelOptionsFromChannels(channels), model: "", imageModel: "", videoModel: "", textModel: "text::missing", audioModel: "" } as AiConfig;

        let errorMessage = "";
        try {
            resolveModelRequestConfigForCapability(config, "text");
        } catch (error) {
            errorMessage = error instanceof Error ? error.message : String(error);
        }
        expect(errorMessage).toBe("Selected text model is unavailable");
    });

    test("keeps same model names selectable across different API keys", () => {
        const channels = [
            { id: "key-a", name: "ProAPI A", baseUrl: "https://a.example.com", apiKey: "sk-channel-a", apiFormat: "openai" as const, models: ["gpt-4o"] },
            { id: "key-b", name: "ProAPI B", baseUrl: "https://b.example.com", apiKey: "sk-channel-b", apiFormat: "openai" as const, models: ["gpt-4o"] },
        ];
        const models = modelOptionsFromChannels(channels);
        const config = { channels, models, model: models[0], imageModel: "", videoModel: "", textModel: models[0], audioModel: "" } as AiConfig;

        expect(models.length).toBe(2);
        expect(models[0]).toBe("key-a::gpt-4o");
        expect(models[1]).toBe("key-b::gpt-4o");
        expect(modelOptionLabel(config, models[0])).toBe("gpt-4o（ProAPI A #1 · a.example.com · Key ...el-a）");
        expect(modelOptionLabel(config, models[1])).toBe("gpt-4o（ProAPI B #2 · b.example.com · Key ...el-b）");
        expect(modelOptionSearchText(config, models[1]).includes("b.example.com")).toBe(true);
        expect(modelOptionSearchText(config, models[1]).includes("el-b")).toBe(true);

        const first = resolveModelRequestConfig(config, models[0]);
        const second = resolveModelRequestConfig(config, models[1]);
        expect(first.apiKey).toBe("sk-channel-a");
        expect(second.apiKey).toBe("sk-channel-b");
        expect(first.baseUrl).toBe("https://a.example.com");
        expect(second.baseUrl).toBe("https://b.example.com");
        expect(first.model).toBe("gpt-4o");
        expect(second.model).toBe("gpt-4o");

        let errorMessage = "";
        try {
            resolveModelRequestConfig(config, "gpt-4o");
        } catch (error) {
            errorMessage = error instanceof Error ? error.message : String(error);
        }
        expect(errorMessage).toBe("Selected model is ambiguous");
    });

    test("only binds legacy bare models when unambiguous and never rebinds a stale channel", () => {
        const channels = [
            { id: "key-a", name: "ProAPI A", baseUrl: "https://a.example.com", apiKey: "sk-channel-a", apiFormat: "openai" as const, models: ["claude-sonnet-4"] },
            { id: "key-b", name: "ProAPI B", baseUrl: "https://b.example.com", apiKey: "sk-channel-b", apiFormat: "openai" as const, models: ["gpt-4o"] },
        ];
        const models = modelOptionsFromChannels(channels);
        const config = { channels, models, model: models[1], imageModel: "", videoModel: "", textModel: models[1], audioModel: "" } as AiConfig;

        expect(normalizeModelOptionValue("gpt-4o", channels)).toBe("key-b::gpt-4o");
        expect(normalizeModelOptionValue("deleted::gpt-4o", channels)).toBe("");
        expect(modelOptionSourceLabel(config, "deleted::gpt-4o")).toBe("未绑定渠道");

        const legacyBare = resolveModelRequestConfig(config, "gpt-4o");
        expect(legacyBare.apiKey).toBe("sk-channel-b");

        let staleChannelError = "";
        try {
            resolveModelRequestConfig(config, "deleted::gpt-4o");
        } catch (error) {
            staleChannelError = error instanceof Error ? error.message : String(error);
        }
        expect(staleChannelError).toBe("Selected model is unavailable");

        let errorMessage = "";
        try {
            resolveModelRequestConfig(config, "");
        } catch (error) {
            errorMessage = error instanceof Error ? error.message : String(error);
        }
        expect(errorMessage).toBe("No model configured");
    });

    test("does not bind a legacy bare model to the first of several matching channels", () => {
        const channels = [
            { id: "key-a", name: "ProAPI A", baseUrl: "https://a.example.com", apiKey: "sk-channel-a", apiFormat: "openai" as const, models: ["gpt-4o"] },
            { id: "key-b", name: "ProAPI B", baseUrl: "https://b.example.com", apiKey: "sk-channel-b", apiFormat: "openai" as const, models: ["gpt-4o"] },
        ];

        expect(normalizeModelOptionValue("gpt-4o", channels)).toBe("");
    });

    test("preserves an explicit invalid node model instead of replacing it with a default", () => {
        const channels = [{ id: "text", name: "Text", baseUrl: "https://text.example.com", apiKey: "sk-text", apiFormat: "openai" as const, models: ["gemini-3.6-flash"] }];
        const config = { channels } as AiConfig;

        expect(normalizeRequestedModelOption(config, "deleted::gpt-image-2", "text::gemini-3.6-flash")).toBe("deleted::gpt-image-2");
        expect(normalizeRequestedModelOption(config, undefined, "text::gemini-3.6-flash")).toBe("text::gemini-3.6-flash");
    });

    test("adds newly fetched same-name models into selectable options", () => {
        const current = ["high::gpt-image-2", "high::imagen-4"];
        const suggested = ["high::gpt-image-2", "medium::gpt-image-2", "medium::agnes-image-2.1-flash"];

        expect(JSON.stringify(mergeSuggestedModelOptions(current, suggested))).toBe(JSON.stringify(["high::gpt-image-2", "high::imagen-4", "medium::gpt-image-2", "medium::agnes-image-2.1-flash"]));
    });
});

describe("server model capabilities", () => {
    test("uses the gateway capability instead of guessing from the model name", () => {
        const previousConfig = useConfigStore.getState().config;
        try {
            useConfigStore.getState().applyServerModels([
                { modelName: "custom-image-text", displayName: "Text model", capability: "text" },
                { modelName: "custom-chat-renderer", displayName: "Image model", capability: "image" },
            ]);
            const next = useConfigStore.getState().config;
            expect(JSON.stringify(next.textModels.map(modelOptionName))).toBe(JSON.stringify(["custom-image-text"]));
            expect(JSON.stringify(next.imageModels.map(modelOptionName))).toBe(JSON.stringify(["custom-chat-renderer"]));
        } finally {
            useConfigStore.setState({ config: previousConfig });
        }
    });
});

describe("strict capability metadata", () => {
    test("does not let a gateway catalog model be reassigned to another capability", () => {
        const channels = [
            {
                id: "gateway",
                name: "Gateway",
                baseUrl: "https://gateway.example.com",
                apiKey: "",
                apiFormat: "openai" as const,
                models: ["gemini-3.6-flash", "gpt-image-2"],
                modelCapabilities: { "gemini-3.6-flash": "text" as const, "gpt-image-2": "image" as const },
            },
        ];
        const config = {
            channels,
            models: modelOptionsFromChannels(channels),
            model: "",
            imageModel: "",
            videoModel: "",
            textModel: "gateway::gpt-image-2",
            audioModel: "",
            imageModels: [],
            videoModels: [],
            textModels: ["gateway::gpt-image-2"],
            audioModels: [],
        } as unknown as AiConfig;

        expect(modelConfiguredForCapability(config, "gateway::gpt-image-2", "text")).toBe(false);
        let errorMessage = "";
        try {
            resolveModelRequestConfigForCapability(config, "text");
        } catch (error) {
            errorMessage = error instanceof Error ? error.message : String(error);
        }
        expect(errorMessage.includes("not configured for text")).toBe(true);
    });

    test("creates the declared capability header for gateway requests", () => {
        const config = {
            channels: [{ id: "text", name: "Text", baseUrl: "https://text.example.com", apiKey: "sk-text", apiFormat: "openai" as const, models: ["gemini-3.6-flash"] }],
            models: ["text::gemini-3.6-flash"],
            model: "",
            imageModel: "",
            videoModel: "",
            textModel: "text::gemini-3.6-flash",
            audioModel: "",
            textModels: ["text::gemini-3.6-flash"],
            imageModels: [],
            videoModels: [],
            audioModels: [],
        } as unknown as AiConfig;
        const resolved = resolveModelRequestConfigForCapability(config, "text");
        expect(resolved.requestCapability).toBe(undefined);
        expect(JSON.stringify(modelCapabilityHeaders({ requestCapability: "text" }))).toBe(JSON.stringify({ "X-GouYingAi-Capability": "text" }));
    });

    test("derives capability options when a legacy config omitted the option arrays", () => {
        const config = {
            channels: [{ id: "gateway", name: "Gateway", baseUrl: "https://gateway.example.com", apiKey: "", apiFormat: "openai" as const, models: ["gemini-3.6-flash"] }],
            models: ["gateway::gemini-3.6-flash"],
            model: "",
            imageModel: "",
            videoModel: "",
            textModel: "gateway::gemini-3.6-flash",
            audioModel: "",
        } as unknown as AiConfig;
        expect(JSON.stringify(selectableModelsByCapability(config, "text"))).toBe(JSON.stringify(["gateway::gemini-3.6-flash"]));
    });
});
