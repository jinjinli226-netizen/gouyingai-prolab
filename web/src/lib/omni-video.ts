export const OMNI_REFERENCE_LIMITS = {
    images: 5,
    videos: 2,
    imageMaxBytes: 8 * 1024 * 1024,
    videoMaxBytes: 8 * 1024 * 1024,
};

const OMNI_MODEL_PATTERN = /^omni-fast(?:-v2v)?(?:-no-water)?$/i;

export function isOmniVideoModel(model: string) {
    return OMNI_MODEL_PATTERN.test(model.trim());
}

export function isOmniV2VModel(model: string) {
    return isOmniVideoModel(model) && /-v2v(?:-|$)/i.test(model);
}

export function normalizeOmniAspectRatio(size: string) {
    if (size === "9:16") return "9:16";
    if (size === "16:9") return "16:9";
    const match = size.match(/^(\d+)x(\d+)$/);
    return Number(match?.[2]) > Number(match?.[1]) ? "9:16" : "16:9";
}

export function omniVideoSettingsSummary(size: string) {
    const aspectRatio = normalizeOmniAspectRatio(size);
    return {
        resolution: "720p",
        ratio: aspectRatio === "9:16" ? "竖屏 9:16" : "横屏 16:9",
        seconds: "约10s",
    };
}

export function omniVideoReferenceError(model: string, imageCount: number, videoCount: number, audioCount: number) {
    if (!isOmniVideoModel(model)) return "";
    if (audioCount) return "Omni 视频暂不支持参考音频";
    if (imageCount > OMNI_REFERENCE_LIMITS.images) return `Omni 最多支持 ${OMNI_REFERENCE_LIMITS.images} 张参考图`;
    if (videoCount > OMNI_REFERENCE_LIMITS.videos) return `Omni V2V 最多支持 ${OMNI_REFERENCE_LIMITS.videos} 个参考视频`;
    if (isOmniV2VModel(model)) {
        if (imageCount) return "Omni V2V 模型只接收参考视频，请移除参考图";
        if (!videoCount) return "Omni V2V 模型必须添加至少一个参考视频";
    } else if (videoCount) {
        return "当前 Omni 模型不支持参考视频，请切换 Omni V2V 模型";
    }
    return "";
}

export function buildOmniVideoJsonBody({ model, prompt, size, images = [], videos = [] }: { model: string; prompt: string; size: string; images?: string[]; videos?: string[] }) {
    const error = omniVideoReferenceError(model, images.length, videos.length, 0);
    if (error) throw new Error(error);
    return {
        model,
        prompt,
        aspect_ratio: normalizeOmniAspectRatio(size),
        seconds: 10,
        ...(images.length ? { images } : {}),
        ...(videos.length ? { videos } : {}),
    };
}

export function buildOmniVideoMultipartBody({ model, prompt, size, videos }: { model: string; prompt: string; size: string; videos: Blob[] }) {
    const error = omniVideoReferenceError(model, 0, videos.length, 0) || omniMediaSizeError([], videos.map((video) => video.size));
    if (error) throw new Error(error);
    const body = new FormData();
    body.append("model", model);
    body.append("prompt", prompt);
    body.append("aspect_ratio", normalizeOmniAspectRatio(size));
    body.append("seconds", "10");
    videos.forEach((video, index) => body.append(index === 0 ? "input_video" : "input_video2", video, `reference-${index + 1}.mp4`));
    return body;
}

export function buildOmniVideoRequestBody({ model, prompt, size, images, videos }: { model: string; prompt: string; size: string; images: string[]; videos: Array<string | Blob> }) {
    if (videos.every((video) => typeof video === "string")) {
        return { contentType: "application/json" as const, body: buildOmniVideoJsonBody({ model, prompt, size, images, videos: videos as string[] }) };
    }
    if (videos.every((video) => video instanceof Blob)) {
        return { contentType: "multipart/form-data" as const, body: buildOmniVideoMultipartBody({ model, prompt, size, videos: videos as Blob[] }) };
    }
    throw new Error("Omni V2V 暂不支持混用公网 URL 和本地视频，请统一参考视频来源");
}

export function omniMediaSizeError(imageSizes: number[], videoSizes: number[]) {
    if (imageSizes.some((size) => size > OMNI_REFERENCE_LIMITS.imageMaxBytes)) return "Omni 参考图单张不能超过 8MB";
    if (videoSizes.some((size) => size > OMNI_REFERENCE_LIMITS.videoMaxBytes)) return "Omni 参考视频单个不能超过 8MB";
    return "";
}

export function readOmniVideoResultUrl(payload: unknown) {
    if (!payload || typeof payload !== "object") return "";
    const data = (payload as { data?: unknown }).data;
    if (!Array.isArray(data) || !data.length || !data[0] || typeof data[0] !== "object") return "";
    const url = (data[0] as { url?: unknown }).url;
    return typeof url === "string" ? url : "";
}
