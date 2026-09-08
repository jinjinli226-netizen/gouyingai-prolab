import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canvasArtifactStoragePath, isOwnedCanvasArtifactPath } from "../canvas-artifact-routes.js";
import { composeUniversalRemakeVideo, extractUniversalContinuationFrame } from "./compositor.js";
const MEDIA_BUCKET = "gouyingai-media";
export function createLocalUniversalCompositionPort(store) {
    return {
        async extractContinuationFrame(run, candidate, segmentArtifactUri) {
            const directory = await mkdtemp(join(tmpdir(), "gouyingai-continuation-"));
            try {
                const result = await extractUniversalContinuationFrame({
                    userId: run.user_id,
                    canvasId: run.canvas_id,
                    artifactUri: segmentArtifactUri,
                }, {
                    outputFilePath: join(directory, "continuation.jpg"),
                    resolveArtifact: async ({ userId, canvasId, uri }) => {
                        const artifact = store.readCanvasArtifact(userId, canvasId, uri);
                        return artifact ? { filePath: artifact.file_path, mimeType: artifact.mime_type } : null;
                    },
                });
                const bytes = await readFile(result.filePath);
                const saved = store.saveCanvasArtifact(run.user_id, run.canvas_id, {
                    name: `${candidate.manifest.id}-continuation.jpg`, mimeType: result.mimeType, bytes,
                    checksum: createHash("sha256").update(bytes).digest("hex"),
                });
                return { artifactUri: saved.uri };
            }
            finally {
                await rm(directory, { recursive: true, force: true });
            }
        },
        async compose(run, candidate, segmentArtifactUris) {
            const directory = await mkdtemp(join(tmpdir(), "gouyingai-compose-"));
            try {
                const result = await composeUniversalRemakeVideo(toCompositionInput(run, candidate, segmentArtifactUris), {
                    temporaryDirectory: directory,
                    outputFilePath: join(directory, "final.mp4"),
                    resolveArtifact: async ({ userId, canvasId, uri }) => {
                        const artifact = store.readCanvasArtifact(userId, canvasId, uri);
                        return artifact ? { filePath: artifact.file_path, mimeType: artifact.mime_type } : null;
                    },
                });
                const bytes = await readFile(result.filePath);
                const saved = store.saveCanvasArtifact(run.user_id, run.canvas_id, {
                    name: `${candidate.manifest.id}.mp4`, mimeType: "video/mp4", bytes,
                    checksum: createHash("sha256").update(bytes).digest("hex"),
                });
                return { artifactUri: saved.uri };
            }
            finally {
                await rm(directory, { recursive: true, force: true });
            }
        },
    };
}
export function createSupabaseUniversalCompositionPort(admin) {
    return {
        async extractContinuationFrame(run, candidate, segmentArtifactUri) {
            const directory = await mkdtemp(join(tmpdir(), "gouyingai-continuation-"));
            try {
                const result = await extractUniversalContinuationFrame({
                    userId: run.user_id,
                    canvasId: run.canvas_id,
                    artifactUri: segmentArtifactUri,
                }, {
                    outputFilePath: join(directory, "continuation.jpg"),
                    resolveArtifact: async ({ userId, canvasId, uri }) => {
                        const storagePath = canvasArtifactStoragePath(uri);
                        if (!isOwnedCanvasArtifactPath(userId, canvasId, storagePath))
                            return null;
                        const download = await admin.storage.from(MEDIA_BUCKET).download(storagePath);
                        if (download.error || !download.data)
                            return null;
                        const localPath = join(directory, `input-${randomUUID()}.mp4`);
                        await writeFile(localPath, Buffer.from(await download.data.arrayBuffer()));
                        return { filePath: localPath, mimeType: download.data.type || "video/mp4" };
                    },
                });
                const bytes = await readFile(result.filePath);
                const id = randomUUID();
                const storagePath = `${encodeURIComponent(run.user_id)}/canvas/${encodeURIComponent(run.canvas_id)}/outputs/${id}.jpg`;
                const upload = await admin.storage.from(MEDIA_BUCKET).upload(storagePath, bytes, { contentType: result.mimeType, upsert: false });
                if (upload.error)
                    throw new Error(upload.error.message);
                return { artifactUri: `canvas-artifact:${storagePath}` };
            }
            finally {
                await rm(directory, { recursive: true, force: true });
            }
        },
        async compose(run, candidate, segmentArtifactUris) {
            const directory = await mkdtemp(join(tmpdir(), "gouyingai-compose-"));
            try {
                const result = await composeUniversalRemakeVideo(toCompositionInput(run, candidate, segmentArtifactUris), {
                    temporaryDirectory: directory,
                    outputFilePath: join(directory, "final.mp4"),
                    resolveArtifact: async ({ userId, canvasId, uri }) => {
                        const storagePath = canvasArtifactStoragePath(uri);
                        if (!isOwnedCanvasArtifactPath(userId, canvasId, storagePath))
                            return null;
                        const download = await admin.storage.from(MEDIA_BUCKET).download(storagePath);
                        if (download.error || !download.data)
                            return null;
                        const localPath = join(directory, `input-${randomUUID()}.mp4`);
                        await writeFile(localPath, Buffer.from(await download.data.arrayBuffer()));
                        return { filePath: localPath, mimeType: download.data.type || "video/mp4" };
                    },
                });
                const bytes = await readFile(result.filePath);
                const id = randomUUID();
                const storagePath = `${encodeURIComponent(run.user_id)}/canvas/${encodeURIComponent(run.canvas_id)}/outputs/${id}.mp4`;
                const upload = await admin.storage.from(MEDIA_BUCKET).upload(storagePath, bytes, { contentType: "video/mp4", upsert: false });
                if (upload.error)
                    throw new Error(upload.error.message);
                return { artifactUri: `canvas-artifact:${storagePath}` };
            }
            finally {
                await rm(directory, { recursive: true, force: true });
            }
        },
    };
}
function toCompositionInput(run, candidate, uris) {
    const output = candidate.manifest.output;
    const targetDurationSeconds = Number(output.targetDurationSeconds);
    const aspectRatio = typeof output.aspectRatio === "string" ? output.aspectRatio : "9:16";
    const boundaries = Array.isArray(output.boundaryKinds) ? output.boundaryKinds.map(String) : [];
    const vertical = aspectRatio === "9:16";
    return {
        userId: run.user_id, canvasId: run.canvas_id, candidateId: candidate.manifest.id,
        targetDurationSeconds, aspectRatio, width: vertical ? 720 : 1280, height: vertical ? 1280 : 720, fps: 30, sampleRate: 48_000,
        segments: candidate.manifest.segments.map((segment, index) => ({
            id: segment.id, artifactUri: uris[index], durationSeconds: segment.durationSeconds,
            boundaryAfter: (boundaries[index] || (index === candidate.manifest.segments.length - 1 ? "none" : "hard-cut")),
            hasAudio: true,
        })),
    };
}
//# sourceMappingURL=composition-port.js.map