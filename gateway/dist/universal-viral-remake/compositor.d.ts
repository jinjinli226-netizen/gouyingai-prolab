import type { UniversalArtifactResolver, UniversalCompositionInput, UniversalCompositionPlan, UniversalProcessRunner } from "./types.js";
export declare class UniversalCompositionError extends Error {
    readonly code: "invalid-plan" | "artifact-not-owned" | "ffmpeg-unavailable" | "ffmpeg-failed";
    constructor(code: "invalid-plan" | "artifact-not-owned" | "ffmpeg-unavailable" | "ffmpeg-failed", message: string);
}
export declare function buildUniversalCompositionPlan(input: UniversalCompositionInput, resolveArtifact: UniversalArtifactResolver): Promise<UniversalCompositionPlan>;
export declare function composeUniversalRemakeVideo(input: UniversalCompositionInput, options: {
    resolveArtifact: UniversalArtifactResolver;
    runProcess?: UniversalProcessRunner;
    ffmpegPath?: string;
    temporaryDirectory?: string;
    outputFilePath?: string;
    writeTextFile?: (path: string, content: string) => Promise<void>;
    ensureDirectory?: (path: string) => Promise<void>;
    removeDirectory?: (path: string) => Promise<void>;
}): Promise<{
    filePath: string;
    durationSeconds: number;
    mimeType: "video/mp4";
}>;
export declare function extractUniversalContinuationFrame(input: {
    userId: string;
    canvasId: string;
    artifactUri: string;
}, options: {
    resolveArtifact: UniversalArtifactResolver;
    runProcess?: UniversalProcessRunner;
    ffmpegPath?: string;
    outputFilePath: string;
    ensureDirectory?: (path: string) => Promise<void>;
}): Promise<{
    filePath: string;
    mimeType: "image/jpeg";
}>;
