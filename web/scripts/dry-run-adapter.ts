import { buildRequest } from "../src/lib/pro-spec/provider-adapter";
import { inferModelInfo } from "../src/lib/pro-spec/model-inference";

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

function readJsonBody(init: RequestInit) {
    assert(typeof init.body === "string", "expected JSON string body");
    return JSON.parse(init.body) as Record<string, unknown>;
}

async function main() {
    const baseUrl = "https://newapi.prorisehub.com";
    const apiKey = "sk-test";

    assert(inferModelInfo("gemini-2.5-flash-image").apiFormat === "dalle", "gemini image should use dalle-compatible protocol");
    assert(inferModelInfo("sora_image").apiFormat === "dalle", "sora_image should use dalle-compatible protocol");
    assert(inferModelInfo("hunyuan-image-v3").apiFormat === "dalle", "hunyuan image should use images generation protocol");
    assert(inferModelInfo("qwen-image-edit").apiFormat === "dalle", "qwen image edit should use images protocol");
    assert(inferModelInfo("flux-kontext-pro").apiFormat === "dalle", "flux kontext should use images protocol");

    const image = buildRequest({
        modelId: "grok-imagine",
        prompt: "a quiet studio",
        modelParams: { aspectRatio: "1:1", quality: "2k" },
        baseUrl,
        apiKey,
    });
    assert(image.url === `${baseUrl}/v1/images/generations`, "dalle url mismatch");
    assert(image.init.method === "POST", "dalle method mismatch");
    const imageBody = readJsonBody(image.init);
    assert(imageBody.model === "grok-imagine", "dalle model mismatch");
    assert(imageBody.aspect_ratio === "1:1", "dalle aspect_ratio missing");
    assert(imageBody.resolution === "2k", "grok resolution missing");

    const hunyuanImage = buildRequest({
        modelId: "hunyuan-image-v3",
        prompt: "a quiet studio",
        modelParams: { size: "1024x1024", quality: "high" },
        baseUrl,
        apiKey,
    });
    assert(hunyuanImage.url === `${baseUrl}/v1/images/generations`, "hunyuan image url mismatch");
    const hunyuanBody = readJsonBody(hunyuanImage.init);
    assert(hunyuanBody.model === "hunyuan-image-v3", "hunyuan model mismatch");
    assert(hunyuanBody.size === "1024x1024", "hunyuan size missing");

    const agnesImage = buildRequest({
        modelId: "agnes-image-2.1-flash",
        prompt: "a quiet studio",
        modelParams: { size: "1024x1024", quality: "high" },
        baseUrl,
        apiKey,
    });
    const agnesBody = readJsonBody(agnesImage.init);
    assert(agnesImage.url === `${baseUrl}/v1/images/generations`, "agnes image url mismatch");
    assert(agnesBody.model === "agnes-image-2.1-flash", "agnes model mismatch");
    assert(!("response_format" in agnesBody), "agnes should not send response_format");
    assert(!("size" in agnesBody), "agnes should not send size");
    assert(!("quality" in agnesBody), "agnes should not send quality");

    const edit = buildRequest({
        operation: "edit",
        modelId: "qwen-image-edit",
        prompt: "edit this image",
        imageFiles: [new File(["image"], "reference.png", { type: "image/png" })],
        modelParams: { size: "1024x1024", negativePrompt: "blur" },
        baseUrl,
        apiKey,
    });
    assert(edit.url === `${baseUrl}/v1/images/edits`, "image edit url mismatch");
    assert(edit.init.method === "POST", "image edit method mismatch");
    assert(edit.init.body instanceof FormData, "image edit body should be FormData");
    const editForm = edit.init.body;
    assert(editForm.get("model") === "qwen-image-edit", "image edit model mismatch");
    assert(editForm.get("negative_prompt") === "blur", "image edit negative_prompt missing");
    assert(editForm.getAll("image").length === 1, "image edit reference image missing");
    assertThrows(() =>
        buildRequest({
            operation: "edit",
            modelId: "qwen-image-edit",
            prompt: "edit this image",
            imageFiles: [new File(["image"], "reference.png", { type: "image/png" })],
            mask: new File(["mask"], "mask.png", { type: "image/png" }),
            baseUrl,
            apiKey,
        }),
        "暂不支持蒙版编辑",
    );

    const openaiVideo = buildRequest({
        modelId: "grok-imagine-video",
        prompt: "make a short video",
        images: ["https://example.com/ref.png"],
        modelParams: { duration: 10, size: "1280x720", resolutionName: "720p", preset: "normal" },
        baseUrl,
        apiKey,
    });
    assert(openaiVideo.url === `${baseUrl}/v1/videos`, "openai-video url mismatch");
    assert(openaiVideo.init.method === "POST", "openai-video method mismatch");
    assert(openaiVideo.init.body instanceof FormData, "openai-video body should be FormData");
    const form = openaiVideo.init.body;
    assert(form.get("seconds") === "10", "openai-video seconds missing");
    assert(form.get("resolution_name") === "720p", "openai-video resolution_name missing");
    assert(form.getAll("input_reference_url[]").length === 1, "openai-video should keep only URL references");
    assertThrows(() =>
        buildRequest({
            modelId: "grok-imagine-video",
            prompt: "make a short video",
            images: ["data:image/png;base64,xxx"],
            baseUrl,
            apiKey,
        }),
        "Grok 视频参考图需要公网 URL",
    );

    const chatVideo = buildRequest({
        modelId: "grok-video-chat",
        prompt: "make a short video",
        modelParams: { duration: 6, size: "1024x1024", resolutionName: "480p", preset: "fun" },
        baseUrl,
        apiKey,
    });
    assert(chatVideo.url === `${baseUrl}/v1/chat/completions`, "grok-video-chat url mismatch");
    assert(chatVideo.init.method === "POST", "grok-video-chat method mismatch");
    const chatBody = readJsonBody(chatVideo.init);
    assert(chatBody.seconds === "6", "grok-video-chat seconds missing");
    assert(chatBody.resolution_name === "480p", "grok-video-chat resolution_name missing");

    const businessError = await image.parseResponse(new Response(JSON.stringify({ code: 429, msg: "quota exhausted" }), { status: 200 }));
    assert(businessError.error === "quota exhausted", "business error envelope should be parsed");

    console.log("adapter dry-run passed");
}

await main();

function assertThrows(fn: () => unknown, message: string) {
    try {
        fn();
    } catch (error) {
        assert(error instanceof Error && error.message.includes(message), `expected error including ${message}`);
        return;
    }
    throw new Error(`expected throw: ${message}`);
}
