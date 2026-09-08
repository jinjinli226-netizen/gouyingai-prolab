const FRAME_ERROR_MESSAGE = "代表帧提取失败";
const FRAME_TIMEOUT_MESSAGE = "代表帧提取超时";
const MAX_FRAME_EDGE = 960;
const WAIT_TIMEOUT_MS = 15_000;
const SEEK_POSITION_TOLERANCE = 0.01;

type Cleanup = () => void;

export async function captureVideoFrame(videoUrl: string, timeSeconds: number): Promise<Blob> {
    const video = document.createElement("video");
    const cleanups = new Set<Cleanup>();

    video.muted = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";

    try {
        const metadataPromise = waitForVideoEvent(video, "loadedmetadata", cleanups);
        video.src = videoUrl;
        await metadataPromise;

        const requestedTime = Number.isFinite(timeSeconds) ? timeSeconds : 0;
        const duration = video.duration;
        let targetTime: number;
        if (duration === Infinity) {
            const seekable = video.seekable;
            if (!seekable || !seekable.length) throw new Error("视频缺少可定位区间");
            const lastRange = seekable.length - 1;
            const rangeStart = lastRange >= 0 ? seekable.start(lastRange) : NaN;
            const rangeEnd = lastRange >= 0 ? seekable.end(lastRange) : NaN;
            if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeEnd < rangeStart) throw new Error("视频缺少可定位区间");
            const maximumTime = Math.max(rangeStart, rangeEnd - 0.01);
            targetTime = Math.min(Math.max(requestedTime, rangeStart), maximumTime);
        } else {
            const maximumTime = Number.isFinite(duration) ? Math.max(0, duration - 0.01) : 0;
            targetTime = Math.min(Math.max(0, requestedTime), maximumTime);
        }

        const samePosition = Number.isFinite(video.currentTime) && Math.abs(video.currentTime - targetTime) <= SEEK_POSITION_TOLERANCE;
        const seek = waitForSeek(video, targetTime === 0 || samePosition, cleanups);
        video.currentTime = targetTime;
        if (video.readyState >= 2 && !video.seeking && Math.abs(video.currentTime - targetTime) <= SEEK_POSITION_TOLERANCE) seek.markReady();
        await seek.promise;

        const sourceWidth = video.videoWidth;
        const sourceHeight = video.videoHeight;
        if (!sourceWidth || !sourceHeight) throw new Error(FRAME_ERROR_MESSAGE);

        const scale = Math.min(1, MAX_FRAME_EDGE / Math.max(sourceWidth, sourceHeight));
        const width = Math.max(1, Math.round(sourceWidth * scale));
        const height = Math.max(1, Math.round(sourceHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        if (!context) throw new Error(FRAME_ERROR_MESSAGE);
        context.drawImage(video, 0, 0, width, height);

        return await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error(FRAME_ERROR_MESSAGE))), "image/jpeg", 0.82);
        });
    } catch (error) {
        throw createFrameError(error);
    } finally {
        cleanups.forEach((cleanup) => cleanup());
        video.onloadedmetadata = null;
        video.onloadeddata = null;
        video.onseeked = null;
        video.onerror = null;
        try {
            video.pause();
        } catch {
            // Ignore cleanup failures.
        }
        try {
            video.removeAttribute("src");
            video.load();
        } catch {
            // Ignore cleanup failures.
        }
    }
}

function waitForVideoEvent(video: HTMLVideoElement, eventName: string, cleanups: Set<Cleanup>) {
    return new Promise<void>((resolve, reject) => {
        let settled = false;
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const cleanup = () => {
            video.removeEventListener(eventName, onSuccess);
            video.removeEventListener("error", onError);
            if (timeout !== undefined) clearTimeout(timeout);
            cleanups.delete(cleanup);
        };
        const settle = (error?: Error) => {
            if (settled) return;
            settled = true;
            cleanup();
            error ? reject(error) : resolve();
        };
        const onSuccess = () => settle();
        const onError = () => settle(new Error(FRAME_ERROR_MESSAGE));

        cleanups.add(cleanup);
        video.addEventListener(eventName, onSuccess);
        video.addEventListener("error", onError);
        timeout = setTimeout(() => settle(new Error(FRAME_TIMEOUT_MESSAGE)), WAIT_TIMEOUT_MS);
    });
}

function waitForSeek(video: HTMLVideoElement, allowLoadedData: boolean, cleanups: Set<Cleanup>) {
    let markReady = () => {};
    const promise = new Promise<void>((resolve, reject) => {
        let settled = false;
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const successEvents = allowLoadedData ? ["seeked", "loadeddata", "canplay"] : ["seeked"];
        const cleanup = () => {
            successEvents.forEach((eventName) => video.removeEventListener(eventName, onSuccess));
            video.removeEventListener("error", onError);
            if (timeout !== undefined) clearTimeout(timeout);
            cleanups.delete(cleanup);
        };
        const settle = (error?: Error) => {
            if (settled) return;
            settled = true;
            cleanup();
            error ? reject(error) : resolve();
        };
        const onSuccess = () => settle();
        const onError = () => settle(new Error(FRAME_ERROR_MESSAGE));

        markReady = onSuccess;
        cleanups.add(cleanup);
        successEvents.forEach((eventName) => video.addEventListener(eventName, onSuccess));
        video.addEventListener("error", onError);
        timeout = setTimeout(() => settle(new Error(FRAME_TIMEOUT_MESSAGE)), WAIT_TIMEOUT_MS);
    });

    return { promise, markReady: () => markReady() };
}

function createFrameError(cause: unknown) {
    const error = new Error(FRAME_ERROR_MESSAGE) as Error & { cause?: unknown };
    error.cause = cause;
    return error;
}
