import assert from "node:assert/strict";
import { describe, test } from "node:test";
import bundledFfmpegPath from "ffmpeg-static";

import {
    buildUniversalCompositionPlan,
    composeUniversalRemakeVideo,
    extractUniversalContinuationFrame,
    UniversalCompositionError,
} from "../src/universal-viral-remake/compositor.ts";

const baseInput = {
    userId: "user-1",
    canvasId: "canvas-1",
    candidateId: "candidate-1",
    targetDurationSeconds: 20,
    aspectRatio: "9:16",
    width: 720,
    height: 1280,
    fps: 30,
    sampleRate: 48000,
    segments: [
        { id: "segment-1", artifactUri: "canvas-artifact:local/a", durationSeconds: 10, boundaryAfter: "hard-cut", hasAudio: true },
        { id: "segment-2", artifactUri: "canvas-artifact:local/b", durationSeconds: 10, boundaryAfter: "none", hasAudio: true },
    ],
};

const resolver = async ({ uri, userId, canvasId }) => {
    assert.equal(userId, "user-1");
    assert.equal(canvasId, "canvas-1");
    return { filePath: `C:/owned/${uri.endsWith("a") ? "a" : "b"}.mp4`, mimeType: "video/mp4" };
};

describe("universal remake compositor", () => {
    test("rejects arbitrary URLs before any process is started", async () => {
        let resolved = false;
        await assert.rejects(
            buildUniversalCompositionPlan({ ...baseInput, targetDurationSeconds: 10, segments: [{ ...baseInput.segments[0], artifactUri: "https://evil.example/a.mp4" }] }, async () => {
                resolved = true;
                return { filePath: "never", mimeType: "video/mp4" };
            }),
            (error) => error instanceof UniversalCompositionError && error.code === "artifact-not-owned",
        );
        assert.equal(resolved, false);
    });

    test("builds a direct concat plan for hard cuts and preserves target duration", async () => {
        const plan = await buildUniversalCompositionPlan(baseInput, resolver);
        assert.equal(plan.mode, "concat");
        assert.equal(plan.targetDurationSeconds, 20);
        assert.deepEqual(plan.inputs.map((item) => item.filePath), ["C:/owned/a.mp4", "C:/owned/b.mp4"]);
        assert.equal(plan.transitions.length, 0);
    });

    test("uses a short bounded transition only for a declared continuous boundary", async () => {
        const input = { ...baseInput, segments: [{ ...baseInput.segments[0], boundaryAfter: "continuous" }, baseInput.segments[1]] };
        const plan = await buildUniversalCompositionPlan(input, resolver);
        assert.equal(plan.mode, "transition");
        assert.equal(plan.transitions.length, 1);
        assert.ok(plan.transitions[0].durationSeconds >= 0.08 && plan.transitions[0].durationSeconds <= 0.16);
    });

    test("invokes ffmpeg with argument arrays and returns the final local artifact", async () => {
        const calls = [];
        const runner = async (command, args) => {
            calls.push({ command, args });
            return { exitCode: 0, stderr: "" };
        };
        const result = await composeUniversalRemakeVideo(baseInput, {
            resolveArtifact: resolver,
            runProcess: runner,
            ffmpegPath: "ffmpeg-safe",
            temporaryDirectory: "C:/owned/tmp",
            outputFilePath: "C:/owned/final.mp4",
            writeTextFile: async () => {},
            ensureDirectory: async () => {},
            removeDirectory: async () => {},
        });
        assert.equal(result.filePath, "C:/owned/final.mp4");
        assert.equal(result.durationSeconds, 20);
        assert.ok(calls.length >= 3);
        assert.ok(calls.every((call) => call.command === "ffmpeg-safe"));
        assert.ok(calls.every((call) => Array.isArray(call.args)));
        assert.ok(calls.at(-1).args.includes("C:/owned/final.mp4"));
    });

    test("uses the bundled ffmpeg when no executable path is configured", async () => {
        const calls = [];
        await composeUniversalRemakeVideo(baseInput, {
            resolveArtifact: resolver,
            runProcess: async (command, args) => {
                calls.push({ command, args });
                return { exitCode: 0, stderr: "" };
            },
            temporaryDirectory: "C:/owned/tmp",
            outputFilePath: "C:/owned/final.mp4",
            writeTextFile: async () => {},
            ensureDirectory: async () => {},
            removeDirectory: async () => {},
        });
        assert.equal(calls[0].command, bundledFfmpegPath ?? "ffmpeg");
    });

    test("extracts one near-terminal frame from an owned video artifact", async () => {
        const calls = [];
        const result = await extractUniversalContinuationFrame({
            userId: "user-1",
            canvasId: "canvas-1",
            artifactUri: "canvas-artifact:local/a",
        }, {
            resolveArtifact: resolver,
            runProcess: async (command, args) => {
                calls.push({ command, args });
                return { exitCode: 0, stderr: "" };
            },
            ffmpegPath: "ffmpeg-safe",
            outputFilePath: "C:/owned/continuation.jpg",
            ensureDirectory: async () => {},
        });

        assert.deepEqual(result, { filePath: "C:/owned/continuation.jpg", mimeType: "image/jpeg" });
        assert.equal(calls.length, 1);
        assert.equal(calls[0].command, "ffmpeg-safe");
        assert.deepEqual(calls[0].args.slice(0, 6), ["-y", "-sseof", "-0.08", "-i", "C:/owned/a.mp4", "-frames:v"]);
        assert.ok(calls[0].args.includes("C:/owned/continuation.jpg"));
    });

    test("returns a typed ffmpeg-unavailable error", async () => {
        await assert.rejects(
            composeUniversalRemakeVideo(baseInput, {
                resolveArtifact: resolver,
                runProcess: async () => { throw Object.assign(new Error("spawn ENOENT"), { code: "ENOENT" }); },
                ffmpegPath: "missing-ffmpeg",
                temporaryDirectory: "C:/owned/tmp",
                outputFilePath: "C:/owned/final.mp4",
                writeTextFile: async () => {},
                ensureDirectory: async () => {},
                removeDirectory: async () => {},
            }),
            (error) => error instanceof UniversalCompositionError && error.code === "ffmpeg-unavailable",
        );
    });
});
