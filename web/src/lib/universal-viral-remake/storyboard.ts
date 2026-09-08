import { captureVideoFrame } from "../video-frame";
import type { UniversalSourceReconstruction } from "./types";

export function buildUniversalStoryboardTimes(durationSeconds: number, maximumFrames = 24): number[] {
    const count = Math.max(6, Math.min(maximumFrames, Math.ceil(durationSeconds * 3)));
    if (durationSeconds <= 0) return [0];
    return Array.from({ length: count }, (_, index) => Math.min(Math.max(0, durationSeconds - 0.02), (durationSeconds * index) / Math.max(1, count - 1)));
}

export function buildUniversalSourceAnchorTimes(reconstruction: UniversalSourceReconstruction, maximumFrames = 8): number[] {
    const duration = Math.max(0, reconstruction.durationSeconds);
    const maximumTime = Math.max(0, duration - 0.02);
    const criticalFacts = reconstruction.timelineUnits.flatMap((unit) => unit.eventFacts).filter((fact) => fact.importance === "critical");
    const candidates = [
        0,
        maximumTime,
        ...criticalFacts.flatMap((fact) => [fact.startSeconds, (fact.startSeconds + fact.endSeconds) / 2, fact.endSeconds]),
    ].map((time) => Number(Math.min(maximumTime, Math.max(0, time)).toFixed(3)));
    const ordered = [...new Set(candidates)].sort((left, right) => left - right);
    const limit = Math.max(2, Math.floor(maximumFrames));
    if (ordered.length <= limit) return ordered;
    return [...new Set(Array.from({ length: limit }, (_, index) => ordered[Math.round((index * (ordered.length - 1)) / (limit - 1))]))];
}

export async function createUniversalStoryboard(videoUrl: string, durationSeconds: number): Promise<{ dataUrl: string; times: number[] }> {
    const times = buildUniversalStoryboardTimes(durationSeconds);
    const blobs = await Promise.all(times.map((time) => captureVideoFrame(videoUrl, time)));
    const images = await Promise.all(blobs.map(blobToImage));
    const columns = 4;
    const cellWidth = 240;
    const cellHeight = 180;
    const rows = Math.ceil(images.length / columns);
    const canvas = document.createElement("canvas");
    canvas.width = columns * cellWidth;
    canvas.height = rows * cellHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("无法创建拉片故事板");
    context.fillStyle = "#0a0a0a";
    context.fillRect(0, 0, canvas.width, canvas.height);
    images.forEach((image, index) => {
        const x = (index % columns) * cellWidth;
        const y = Math.floor(index / columns) * cellHeight;
        const scale = Math.min(cellWidth / image.width, cellHeight / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        context.drawImage(image, x + (cellWidth - width) / 2, y + (cellHeight - height) / 2, width, height);
        context.fillStyle = "rgba(0,0,0,.72)";
        context.fillRect(x + 6, y + 6, 70, 23);
        context.fillStyle = "#fff";
        context.font = "14px sans-serif";
        context.fillText(`${times[index].toFixed(2)}s`, x + 12, y + 23);
    });
    return { dataUrl: canvas.toDataURL("image/jpeg", 0.86), times };
}

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const image = new Image();
        image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
        image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("拉片帧读取失败")); };
        image.src = url;
    });
}
