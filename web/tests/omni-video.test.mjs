import assert from "node:assert/strict";
import test from "node:test";

import { inferModelInfo } from "../src/lib/pro-spec/model-inference.ts";

const omni = await import("../src/lib/omni-video.ts").catch(() => ({}));

test("recognizes every Omni model as a Google OpenAI-compatible video model", () => {
    for (const model of ["omni-fast", "omni-fast-v2v", "omni-fast-no-water", "omni-fast-v2v-no-water"]) {
        const info = inferModelInfo(model);
        assert.equal(info.category, "video");
        assert.equal(info.group, "Google");
        assert.equal(info.apiFormat, "openai-video");
        assert.equal(omni.isOmniVideoModel?.(model), true);
    }
    assert.equal(omni.isOmniV2VModel?.("omni-fast-v2v-no-water"), true);
    assert.equal(omni.isOmniV2VModel?.("omni-fast-no-water"), false);
});

test("normalizes Omni settings to the supported ratio and fixed duration", () => {
    assert.equal(omni.normalizeOmniAspectRatio?.("720x1280"), "9:16");
    assert.equal(omni.normalizeOmniAspectRatio?.("1024x1024"), "16:9");
    assert.deepEqual(omni.omniVideoSettingsSummary?.("1024x1024"), {
        resolution: "720p",
        ratio: "横屏 16:9",
        seconds: "约10s",
    });
    assert.deepEqual(omni.omniVideoSettingsSummary?.("720x1280"), {
        resolution: "720p",
        ratio: "竖屏 9:16",
        seconds: "约10s",
    });
    assert.deepEqual(
        omni.buildOmniVideoJsonBody?.({
            model: "omni-fast",
            prompt: "rainy street",
            size: "720x1280",
            images: ["data:image/png;base64,a"],
        }),
        {
            model: "omni-fast",
            prompt: "rainy street",
            aspect_ratio: "9:16",
            seconds: 10,
            images: ["data:image/png;base64,a"],
        },
    );
});

test("enforces Omni image and V2V reference contracts", () => {
    assert.match(omni.omniVideoReferenceError?.("omni-fast", 0, 1, 0) || "", /V2V/);
    assert.match(omni.omniVideoReferenceError?.("omni-fast-v2v", 0, 0, 0) || "", /参考视频/);
    assert.match(omni.omniVideoReferenceError?.("omni-fast", 6, 0, 0) || "", /5/);
    assert.match(omni.omniVideoReferenceError?.("omni-fast-v2v", 0, 3, 0) || "", /2/);
    assert.match(omni.omniVideoReferenceError?.("omni-fast", 0, 0, 1) || "", /音频/);
    assert.equal(omni.omniVideoReferenceError?.("omni-fast-v2v", 0, 2, 0), "");
});

test("reads completed Omni videos from data[0].url", () => {
    assert.equal(
        omni.readOmniVideoResultUrl?.({ status: "completed", data: [{ url: "/v1/videos/task-omni/content" }] }),
        "/v1/videos/task-omni/content",
    );
});

test("builds Omni local V2V inputs as multipart files", () => {
    const body = omni.buildOmniVideoMultipartBody?.({
        model: "omni-fast-v2v-no-water",
        prompt: "cyberpunk",
        size: "1280x720",
        videos: [new Blob(["first"], { type: "video/mp4" }), new Blob(["second"], { type: "video/mp4" })],
    });
    assert.equal(body instanceof FormData, true);
    assert.equal(body?.get("model"), "omni-fast-v2v-no-water");
    assert.equal(body?.get("aspect_ratio"), "16:9");
    assert.equal(body?.get("seconds"), "10");
    assert.equal(body?.get("input_video") instanceof Blob, true);
    assert.equal(body?.get("input_video2") instanceof Blob, true);
});

test("rejects Omni references larger than eight megabytes", () => {
    const overLimit = 8 * 1024 * 1024 + 1;
    assert.match(omni.omniMediaSizeError?.([overLimit], []) || "", /8MB/);
    assert.match(omni.omniMediaSizeError?.([], [overLimit]) || "", /8MB/);
    assert.equal(omni.omniMediaSizeError?.([1024], [2048]), "");
});

test("chooses JSON for image or URL references and multipart for local V2V files", () => {
    const imageRequest = omni.buildOmniVideoRequestBody?.({ model: "omni-fast", prompt: "move", size: "16:9", images: ["data:image/png;base64,a"], videos: [] });
    assert.equal(imageRequest?.contentType, "application/json");
    assert.equal(Array.isArray(imageRequest?.body.images), true);

    const videoRequest = omni.buildOmniVideoRequestBody?.({ model: "omni-fast-v2v", prompt: "restyle", size: "16:9", images: [], videos: [new Blob(["video"], { type: "video/mp4" })] });
    assert.equal(videoRequest?.contentType, "multipart/form-data");
    assert.equal(videoRequest?.body instanceof FormData, true);
});
