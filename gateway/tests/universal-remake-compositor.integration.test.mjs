import assert from "node:assert/strict";
import { test } from "node:test";
import { access, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";

import { composeUniversalRemakeVideo } from "../src/universal-viral-remake/compositor.ts";

test("real FFmpeg composes normalized segments into the exact logical output", async (context) => {
    if (!(await available("ffmpeg")) || !(await available("ffprobe"))) return context.skip("FFmpeg is not installed");
    const directory = await mkdtemp(join(tmpdir(), "universal-ffmpeg-test-"));
    try {
        const first = join(directory, "first.mp4");
        const second = join(directory, "second.mp4");
        await run("ffmpeg", ["-y", "-f", "lavfi", "-i", "color=c=red:s=320x240:d=1", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", first]);
        await run("ffmpeg", ["-y", "-f", "lavfi", "-i", "color=c=blue:s=240x320:d=1", "-f", "lavfi", "-i", "sine=frequency=660:duration=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", second]);
        const output = join(directory, "final.mp4");
        await composeUniversalRemakeVideo({
            userId: "local", canvasId: "canvas", candidateId: "candidate", targetDurationSeconds: 2, aspectRatio: "9:16",
            width: 360, height: 640, fps: 24, sampleRate: 48000,
            segments: [
                { id: "one", artifactUri: "canvas-artifact:one", durationSeconds: 1, boundaryAfter: "hard-cut", hasAudio: true },
                { id: "two", artifactUri: "canvas-artifact:two", durationSeconds: 1, boundaryAfter: "none", hasAudio: true },
            ],
        }, {
            temporaryDirectory: join(directory, "work"), outputFilePath: output,
            resolveArtifact: async ({ uri }) => ({ filePath: uri.endsWith("one") ? first : second, mimeType: "video/mp4" }),
        });
        await access(output);
        const duration = Number((await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", output])).stdout.trim());
        assert.ok(Math.abs(duration - 2) <= 0.1, `expected 2s, received ${duration}s`);
    } finally { await rm(directory, { recursive: true, force: true }); }
});

async function available(command) {
    try { return (await run(command, ["-version"])).exitCode === 0; } catch { return false; }
}

function run(command, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (chunk) => { stdout += String(chunk); });
        child.stderr.on("data", (chunk) => { stderr += String(chunk); });
        child.once("error", reject);
        child.once("close", (code) => code === 0 ? resolve({ exitCode: code, stdout, stderr }) : reject(new Error(stderr)));
    });
}
