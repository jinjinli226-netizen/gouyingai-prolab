import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import bundledFfmpegPath from "ffmpeg-static";
const bundledFfmpegExecutable = bundledFfmpegPath;
const TRANSITION_SECONDS = 0.12;
export class UniversalCompositionError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = "UniversalCompositionError";
    }
}
export async function buildUniversalCompositionPlan(input, resolveArtifact) {
    validateCompositionInput(input);
    const resolvedInputs = [];
    for (const segment of input.segments) {
        if (!segment.artifactUri.startsWith("canvas-artifact:")) {
            throw new UniversalCompositionError("artifact-not-owned", `片段 ${segment.id} 不是画布托管素材`);
        }
        const artifact = await resolveArtifact({ userId: input.userId, canvasId: input.canvasId, uri: segment.artifactUri });
        if (!artifact || !artifact.mimeType.startsWith("video/")) {
            throw new UniversalCompositionError("artifact-not-owned", `片段 ${segment.id} 不属于当前用户与画布`);
        }
        resolvedInputs.push({ ...segment, ...artifact });
    }
    const transitions = input.segments.slice(0, -1).flatMap((segment, index) => (segment.boundaryAfter === "continuous" || segment.boundaryAfter === "transition"
        ? [{ afterSegmentIndex: index, durationSeconds: TRANSITION_SECONDS }]
        : []));
    return {
        mode: transitions.length ? "transition" : "concat",
        targetDurationSeconds: input.targetDurationSeconds,
        width: input.width,
        height: input.height,
        fps: input.fps,
        sampleRate: input.sampleRate,
        inputs: resolvedInputs,
        transitions,
    };
}
export async function composeUniversalRemakeVideo(input, options) {
    const plan = await buildUniversalCompositionPlan(input, options.resolveArtifact);
    const runner = options.runProcess ?? runProcess;
    const ffmpegPath = resolveFfmpegPath(options.ffmpegPath);
    const temporaryDirectory = options.temporaryDirectory ?? await mkdtemp(join(tmpdir(), "gouyingai-remake-"));
    const outputFilePath = options.outputFilePath ?? join(temporaryDirectory, "final.mp4");
    const ensureDirectory = options.ensureDirectory ?? (async (path) => { await mkdir(path, { recursive: true }); });
    const writeText = options.writeTextFile ?? (async (path, content) => { await writeFile(path, content, "utf8"); });
    const cleanup = options.removeDirectory ?? (async (path) => { await rm(path, { recursive: true, force: true }); });
    await ensureDirectory(temporaryDirectory);
    await ensureDirectory(dirname(outputFilePath));
    try {
        const normalizedFiles = [];
        for (let index = 0; index < plan.inputs.length; index += 1) {
            const item = plan.inputs[index];
            const normalized = join(temporaryDirectory, `normalized-${index + 1}.mp4`);
            await runChecked(runner, ffmpegPath, normalizeArgs(item.filePath, normalized, item.durationSeconds, item.hasAudio, plan), `标准化片段 ${item.id}`);
            normalizedFiles.push(normalized);
        }
        if (plan.mode === "concat") {
            const listPath = join(temporaryDirectory, "concat.txt");
            await writeText(listPath, normalizedFiles.map((path) => `file '${path.replaceAll("'", "'\\''")}'`).join("\n"));
            await runChecked(runner, ffmpegPath, [
                "-y", "-f", "concat", "-safe", "0", "-i", listPath,
                "-c", "copy", "-t", fixed(input.targetDurationSeconds), "-movflags", "+faststart", outputFilePath,
            ], "拼接长视频");
        }
        else {
            await runChecked(runner, ffmpegPath, transitionArgs(normalizedFiles, plan, outputFilePath), "衔接长视频");
        }
        return { filePath: outputFilePath, durationSeconds: input.targetDurationSeconds, mimeType: "video/mp4" };
    }
    catch (error) {
        await cleanup(temporaryDirectory).catch(() => undefined);
        if (error instanceof UniversalCompositionError)
            throw error;
        if (error?.code === "ENOENT")
            throw new UniversalCompositionError("ffmpeg-unavailable", "当前 Gateway 未安装或无法执行 FFmpeg");
        throw error;
    }
}
export async function extractUniversalContinuationFrame(input, options) {
    if (!input.artifactUri.startsWith("canvas-artifact:")) {
        throw new UniversalCompositionError("artifact-not-owned", "续接片段不是画布托管素材");
    }
    const artifact = await options.resolveArtifact({
        userId: input.userId,
        canvasId: input.canvasId,
        uri: input.artifactUri,
    });
    if (!artifact || !artifact.mimeType.startsWith("video/")) {
        throw new UniversalCompositionError("artifact-not-owned", "续接片段不属于当前用户与画布");
    }
    const ensureDirectory = options.ensureDirectory ?? (async (path) => { await mkdir(path, { recursive: true }); });
    await ensureDirectory(dirname(options.outputFilePath));
    await runChecked(options.runProcess ?? runProcess, resolveFfmpegPath(options.ffmpegPath), [
        "-y", "-sseof", "-0.08", "-i", artifact.filePath,
        "-frames:v", "1", "-q:v", "2", options.outputFilePath,
    ], "提取分段续接末帧");
    return { filePath: options.outputFilePath, mimeType: "image/jpeg" };
}
function normalizeArgs(inputPath, outputPath, durationSeconds, hasAudio, plan) {
    const args = ["-y", "-i", inputPath];
    if (!hasAudio)
        args.push("-f", "lavfi", "-t", fixed(durationSeconds), "-i", `anullsrc=r=${plan.sampleRate}:cl=stereo`);
    args.push("-map", "0:v:0", "-map", hasAudio ? "0:a:0?" : "1:a:0", "-vf", `scale=${plan.width}:${plan.height}:force_original_aspect_ratio=decrease,pad=${plan.width}:${plan.height}:(ow-iw)/2:(oh-ih)/2,fps=${plan.fps},format=yuv420p`, "-af", `aresample=${plan.sampleRate}:async=1:first_pts=0`, "-t", fixed(durationSeconds), "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-c:a", "aac", "-ar", String(plan.sampleRate), "-ac", "2", "-movflags", "+faststart", outputPath);
    return args;
}
function transitionArgs(files, plan, outputPath) {
    const args = ["-y"];
    files.forEach((file) => args.push("-i", file));
    const filters = [];
    files.forEach((_, index) => {
        filters.push(`[${index}:v]settb=AVTB,setpts=PTS-STARTPTS[v${index}]`);
        filters.push(`[${index}:a]aresample=${plan.sampleRate},asetpts=PTS-STARTPTS[a${index}]`);
    });
    let video = "v0";
    let audio = "a0";
    let elapsed = plan.inputs[0].durationSeconds;
    for (let index = 1; index < files.length; index += 1) {
        const declared = plan.transitions.find((transition) => transition.afterSegmentIndex === index - 1);
        const duration = declared?.durationSeconds ?? 0.001;
        const nextVideo = `vx${index}`;
        const nextAudio = `ax${index}`;
        const offset = Math.max(0, elapsed - duration);
        filters.push(`[${video}][v${index}]xfade=transition=fade:duration=${fixed(duration)}:offset=${fixed(offset)}[${nextVideo}]`);
        filters.push(`[${audio}][a${index}]acrossfade=d=${fixed(duration)}:c1=tri:c2=tri[${nextAudio}]`);
        video = nextVideo;
        audio = nextAudio;
        elapsed += plan.inputs[index].durationSeconds - duration;
    }
    const missing = Math.max(0, plan.targetDurationSeconds - elapsed);
    filters.push(`[${video}]tpad=stop_mode=clone:stop_duration=${fixed(missing)},trim=duration=${fixed(plan.targetDurationSeconds)}[vout]`);
    filters.push(`[${audio}]apad=pad_dur=${fixed(missing)},atrim=duration=${fixed(plan.targetDurationSeconds)}[aout]`);
    args.push("-filter_complex", filters.join(";"), "-map", "[vout]", "-map", "[aout]", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", String(plan.sampleRate), "-ac", "2", "-t", fixed(plan.targetDurationSeconds), "-movflags", "+faststart", outputPath);
    return args;
}
async function runChecked(runner, command, args, label) {
    let result;
    try {
        result = await runner(command, args);
    }
    catch (error) {
        if (error?.code === "ENOENT")
            throw new UniversalCompositionError("ffmpeg-unavailable", "当前 Gateway 未安装或无法执行 FFmpeg");
        throw error;
    }
    if (result.exitCode !== 0)
        throw new UniversalCompositionError("ffmpeg-failed", `${label}失败：${result.stderr.slice(-1000)}`);
}
function resolveFfmpegPath(explicitPath) {
    return explicitPath?.trim() || process.env.FFMPEG_PATH?.trim() || bundledFfmpegExecutable || "ffmpeg";
}
function runProcess(command, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { shell: false, windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
        let stderr = "";
        child.stderr.on("data", (chunk) => { stderr = `${stderr}${String(chunk)}`.slice(-20_000); });
        child.once("error", reject);
        child.once("close", (code) => resolve({ exitCode: code ?? -1, stderr }));
    });
}
function validateCompositionInput(input) {
    if (!input.userId || !input.canvasId || !input.candidateId)
        throw new UniversalCompositionError("invalid-plan", "合成任务缺少所有权信息");
    if (!input.segments.length)
        throw new UniversalCompositionError("invalid-plan", "合成任务没有片段");
    if (!Number.isFinite(input.targetDurationSeconds) || input.targetDurationSeconds <= 0)
        throw new UniversalCompositionError("invalid-plan", "目标时长无效");
    if (![input.width, input.height, input.fps, input.sampleRate].every((value) => Number.isInteger(value) && value > 0))
        throw new UniversalCompositionError("invalid-plan", "输出规格无效");
    const total = input.segments.reduce((sum, segment) => sum + segment.durationSeconds, 0);
    if (input.segments.some((segment) => !Number.isFinite(segment.durationSeconds) || segment.durationSeconds <= 0) || Math.abs(total - input.targetDurationSeconds) > 0.1) {
        throw new UniversalCompositionError("invalid-plan", "片段时长无法覆盖目标视频");
    }
}
function fixed(value) {
    return value.toFixed(3).replace(/\.?0+$/, "");
}
//# sourceMappingURL=compositor.js.map