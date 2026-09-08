import { readFile, writeFile } from "node:fs/promises";

import { reconstructUniversalSource, verifyUniversalSourceReconstruction } from "../src/lib/universal-viral-remake/index.ts";
import type { UniversalReconstructionInput, UniversalUnderstandingRequest } from "../src/lib/universal-viral-remake/index.ts";

const [storyboardPath, outputPath, durationArg = "8.033333", aspectRatio = "9:16", sourceVideoId = "debug-source-video"] = process.argv.slice(2);
if (!storyboardPath || !outputPath) throw new Error("Usage: run-universal-remake-debug <storyboard.jpg> <output.json> [duration] [aspectRatio] [sourceVideoId]");

const durationSeconds = Number(durationArg);
if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) throw new Error("Invalid duration");

const frameCount = 13;
const times = Array.from({ length: frameCount }, (_, index) => Number(((durationSeconds * index) / (frameCount - 1)).toFixed(3)));
const evidence = [{
    id: "storyboard-1",
    atSeconds: 0,
    kind: "frame" as const,
    artifactId: sourceVideoId,
    description: `Single chronological storyboard containing ${frameCount} timestamped frames at ${times.join(", ")} seconds. The source video itself is ${durationSeconds.toFixed(3)} seconds.`,
}];
const source: UniversalReconstructionInput = {
    sourceVideoId,
    durationSeconds,
    aspectRatio,
    evidence,
};

const imageBase64 = (await readFile(storyboardPath)).toString("base64");
const imageDataUrl = `data:image/jpeg;base64,${imageBase64}`;
let requestCount = 0;
const port = {
    understandVideo: async (request: UniversalUnderstandingRequest) => {
        requestCount += 1;
        const response = await fetch(process.env.GOUYINGAI_DEBUG_GATEWAY_URL || "http://127.0.0.1:8788/v1/chat/completions", {
            method: "POST",
            headers: { "content-type": "application/json", "x-gouyingai-capability": "text" },
            body: JSON.stringify({
                model: process.env.GOUYINGAI_DEBUG_TEXT_MODEL || "gemini-3.7-flash-high",
                stream: false,
                max_tokens: 8192,
                messages: [{
                    role: "user",
                    content: [
                        { type: "text", text: request.prompt },
                        { type: "image_url", image_url: { url: imageDataUrl } },
                    ],
                }],
            }),
        });
        const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: unknown };
        if (!response.ok) throw new Error(`Gateway ${response.status}: ${JSON.stringify(payload.error ?? payload)}`);
        const content = payload.choices?.[0]?.message?.content;
        if (!content) throw new Error("Vision model returned no content");
        return content;
    },
};

const initial = await reconstructUniversalSource(source, port);
const verified = await verifyUniversalSourceReconstruction(source, initial, port);
await writeFile(outputPath, `${JSON.stringify(verified, null, 2)}\n`, "utf8");
process.stdout.write(JSON.stringify({
    outputPath,
    requestCount,
    verification: verified.verification,
    entityCount: verified.entities.length,
    timelineUnitCount: verified.timelineUnits.length,
    timeline: verified.timelineUnits.map((unit) => ({
        id: unit.id,
        start: unit.sourceStartSeconds,
        end: unit.sourceEndSeconds,
        direction: unit.direction,
    })),
}, null, 2));
