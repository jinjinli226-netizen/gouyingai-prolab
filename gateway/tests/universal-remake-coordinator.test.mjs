import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { LocalStore } from "../src/local-store.ts";
import { createLocalCanvasJobRepository } from "../src/canvas-job-repository.ts";
import { createLocalUniversalRemakeRepository } from "../src/universal-viral-remake/repository.ts";
import { UniversalRemakeCoordinator } from "../src/universal-viral-remake/coordinator.ts";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const candidate = (index, segmentCount = 2) => ({
    id: `candidate-${index}`,
    index,
    segments: Array.from({ length: segmentCount }, (_, segmentIndex) => ({
        id: `candidate-${index}:segment-${segmentIndex}`,
        index: segmentIndex,
        prompt: `prompt ${index}-${segmentIndex}`,
        durationSeconds: 5,
        modelId: "video-model",
        referenceAssetIds: [],
    })),
    output: segmentCount === 1
        ? { kind: "direct-video", sourceSegmentId: `candidate-${index}:segment-0`, targetDurationSeconds: 5 }
        : { kind: "composed-video", orderedSegmentIds: [`candidate-${index}:segment-0`, `candidate-${index}:segment-1`], boundaryKinds: ["hard-cut"], targetDurationSeconds: 10, aspectRatio: "9:16", audioPolicy: "segment-native" },
});

const fidelityContract = {
    schemaVersion: 3,
    durationSeconds: 10,
    aspectRatio: "9:16",
    canonicalPrompt: "@角色1 保持背向镜头完成连续动作。",
    timelineUnits: [{
        id: "unit-1", sourceStartSeconds: 0, sourceEndSeconds: 10, direction: "@角色1 保持背向镜头完成连续动作。",
        structuralInvariants: [{ id: "invariant-facing", dimension: "主体朝向", description: "@角色1 始终背向镜头", importance: "critical" }],
        eventFacts: [{ id: "fact-contact", family: "relation-contact", dimension: "接触顺序", predicate: "先接触后分离", startSeconds: 3, endSeconds: 8, importance: "critical" }],
        startContinuity: { facts: [{ dimension: "姿态", description: "低姿态蓄力", participantPlaceholderIds: ["@角色1"] }] },
        endContinuity: { facts: [{ dimension: "终态", description: "主体重新站起", participantPlaceholderIds: ["@角色1"] }] },
    }],
};

async function harness() {
    const directory = await mkdtemp(join(tmpdir(), "universal-run-test-"));
    const store = new LocalStore(join(directory, "store.json"));
    return {
        directory,
        store,
        jobs: createLocalCanvasJobRepository(store),
        runs: createLocalUniversalRemakeRepository(store),
    };
}

const createInput = (clientRequestId = "request-1") => ({
    canvas_id: "canvas-1",
    target_node_id: "results-node",
    generation_revision: 1,
    client_request_id: clientRequestId,
    template_id: "template-1",
    model_id: "video-model",
    channel_id: null,
    fidelity_model_id: "vision-model",
    fidelity_channel_id: "vision-channel",
    source_video_artifact_uri: "canvas-artifact:local/source-video",
    source_reference_asset_ids: ["canvas-artifact:local/source-storyboard"],
    fidelity_contract: fidelityContract,
    fidelity_threshold: 85,
    max_fidelity_retries: 1,
    max_in_flight: 2,
    candidates: [candidate(0), candidate(1), candidate(2)],
});

describe("persistent universal remake coordinator", () => {
    test("persists runs and keeps create idempotent by user and client request", async () => {
        const h = await harness();
        try {
            const first = await h.runs.create("local", createInput());
            const again = await h.runs.create("local", createInput());
            assert.equal(again.id, first.id);
            const persisted = JSON.parse(await readFile(join(h.directory, "store.json"), "utf8"));
            assert.equal(persisted.universalRemakeRuns.length, 1);
        } finally { await rm(h.directory, { recursive: true, force: true }); }
    });

    test("bounds in-flight candidates and materializes only the first segment of each", async () => {
        const h = await harness();
        try {
            const run = await h.runs.create("local", createInput());
            const coordinator = new UniversalRemakeCoordinator(h.runs, h.jobs, { compose: async () => ({ artifactUri: "canvas-artifact:local/final" }) });
            await coordinator.reconcile(run.id);
            const jobs = await h.jobs.list("local", { batchId: run.id });
            assert.equal(jobs.length, 2);
            assert.ok(jobs.every((job) => job.input.segmentIndex === 0));
            assert.deepEqual(jobs.map((job) => job.candidate_index).sort(), [0, 1]);
        } finally { await rm(h.directory, { recursive: true, force: true }); }
    });

    test("rounds fractional semantic segment durations up for integer-only video providers", async () => {
        const h = await harness();
        try {
            const fractional = candidate(0, 1);
            fractional.segments[0].durationSeconds = 8.033;
            const run = await h.runs.create("local", { ...createInput(), max_in_flight: 1, candidates: [fractional] });
            const coordinator = new UniversalRemakeCoordinator(h.runs, h.jobs, { compose: async () => ({ artifactUri: "canvas-artifact:local/final" }) });

            await coordinator.reconcile(run.id);

            const jobs = await h.jobs.list("local", { batchId: run.id });
            assert.equal(jobs.length, 1);
            assert.equal(jobs[0].input.seconds, "9");
            assert.equal(jobs[0].input.duration, "9");
            assert.equal(jobs[0].input.durationSeconds, 8.033);
        } finally { await rm(h.directory, { recursive: true, force: true }); }
    });

    test("keeps segments sequential and composes exactly one logical result per candidate", async () => {
        const h = await harness();
        try {
            const run = await h.runs.create("local", { ...createInput(), max_in_flight: 1, candidates: [candidate(0)] });
            let composeCalls = 0;
            const coordinator = new UniversalRemakeCoordinator(h.runs, h.jobs, { compose: async (_run, _candidate, uris) => {
                composeCalls += 1;
                assert.deepEqual(uris, ["canvas-artifact:local/segment-0", "canvas-artifact:local/segment-1"]);
                return { artifactUri: "canvas-artifact:local/final" };
            } });
            await coordinator.reconcile(run.id);
            let jobs = await h.jobs.list("local", { batchId: run.id });
            await h.jobs.update(jobs[0].id, { status: "succeeded", result: { artifactUri: "canvas-artifact:local/segment-0" } });
            await coordinator.reconcile(run.id);
            jobs = await h.jobs.list("local", { batchId: run.id });
            assert.equal(jobs.length, 2);
            const second = jobs.find((job) => job.input.segmentIndex === 1);
            assert.ok(second);
            await h.jobs.update(second.id, { status: "succeeded", result: { artifactUri: "canvas-artifact:local/segment-1" } });
            await coordinator.reconcile(run.id);
            const finished = await h.runs.get("local", run.id);
            assert.equal(composeCalls, 1);
            assert.equal(finished.status, "running");
            assert.equal(finished.candidates[0].output_artifact_uri, "canvas-artifact:local/final");
            assert.equal(finished.candidates[0].status, "evaluating");
            assert.equal(finished.candidates[0].fidelity_status, "pending");
            assert.deepEqual(finished.candidates[0].fidelity_issues, []);
        } finally { await rm(h.directory, { recursive: true, force: true }); }
    });

    test("extracts the previous segment end frame and sends it as the next segment's highest-priority image reference", async () => {
        const h = await harness();
        try {
            const manifest = candidate(0);
            manifest.segments[0].referenceAssetIds = ["canvas-artifact:local/source-a", "canvas-artifact:local/source-b"];
            manifest.segments[1].referenceAssetIds = ["canvas-artifact:local/source-a", "canvas-artifact:local/source-b"];
            manifest.segments[1].continuationFrameFromSegmentId = manifest.segments[0].id;
            manifest.segments[1].maxReferenceImages = 2;
            const run = await h.runs.create("local", { ...createInput(), max_in_flight: 1, candidates: [manifest] });
            const extracted = [];
            const coordinator = new UniversalRemakeCoordinator(h.runs, h.jobs, {
                compose: async () => ({ artifactUri: "canvas-artifact:local/final" }),
                extractContinuationFrame: async (_run, _candidate, videoArtifactUri) => {
                    extracted.push(videoArtifactUri);
                    return { artifactUri: "canvas-artifact:local/continuation-frame" };
                },
            });

            await coordinator.reconcile(run.id);
            let jobs = await h.jobs.list("local", { batchId: run.id });
            await h.jobs.update(jobs[0].id, { status: "succeeded", result: { artifactUri: "canvas-artifact:local/segment-0" } });
            await coordinator.reconcile(run.id);

            jobs = await h.jobs.list("local", { batchId: run.id });
            const second = jobs.find((job) => job.input.segmentIndex === 1);
            assert.deepEqual(extracted, ["canvas-artifact:local/segment-0"]);
            assert.deepEqual(second.input.referenceImages, ["canvas-artifact:local/continuation-frame", "canvas-artifact:local/source-a"]);
            assert.deepEqual(second.input.referenceVideos, []);
            const state = await h.runs.get("local", run.id);
            assert.equal(state.candidates[0].continuation_frame_artifact_uris[1], "canvas-artifact:local/continuation-frame");
        } finally { await rm(h.directory, { recursive: true, force: true }); }
    });

    test("serializes concurrent reconciliation so one candidate is composed only once", async () => {
        const h = await harness();
        try {
            const run = await h.runs.create("local", { ...createInput(), max_in_flight: 1, candidates: [candidate(0)] });
            await h.runs.updateCandidate(run.id, 0, {
                status: "composing",
                segment_artifact_uris: ["canvas-artifact:local/segment-0", "canvas-artifact:local/segment-1"],
            });
            let composeCalls = 0;
            let releaseComposition;
            let markEntered;
            const entered = new Promise((resolve) => { markEntered = resolve; });
            const gate = new Promise((resolve) => { releaseComposition = resolve; });
            const coordinator = new UniversalRemakeCoordinator(h.runs, h.jobs, {
                compose: async () => {
                    composeCalls += 1;
                    markEntered();
                    await gate;
                    return { artifactUri: "canvas-artifact:local/final" };
                },
            });

            const first = coordinator.reconcile(run.id);
            await entered;
            const overlapping = [coordinator.reconcile(run.id), coordinator.reconcile(run.id)];
            await new Promise((resolve) => setTimeout(resolve, 20));
            releaseComposition();
            await Promise.all([first, ...overlapping]);

            assert.equal(composeCalls, 1);
        } finally { await rm(h.directory, { recursive: true, force: true }); }
    });

    test("retries a failed composition without regenerating successful segments", async () => {
        const h = await harness();
        try {
            const run = await h.runs.create("local", { ...createInput(), max_in_flight: 1, candidates: [candidate(0)] });
            let fail = true;
            const coordinator = new UniversalRemakeCoordinator(h.runs, h.jobs, { compose: async () => {
                if (fail) throw new Error("compose failed");
                return { artifactUri: "canvas-artifact:local/final" };
            } });
            await coordinator.reconcile(run.id);
            let jobs = await h.jobs.list("local", { batchId: run.id });
            await h.jobs.update(jobs[0].id, { status: "succeeded", result: { artifactUri: "canvas-artifact:local/s0" } });
            await coordinator.reconcile(run.id);
            jobs = await h.jobs.list("local", { batchId: run.id });
            const second = jobs.find((job) => job.input.segmentIndex === 1);
            assert.ok(second);
            await h.jobs.update(second.id, { status: "succeeded", result: { artifactUri: "canvas-artifact:local/s1" } });
            await coordinator.reconcile(run.id);
            assert.equal((await h.runs.get("local", run.id)).candidates[0].status, "failed");
            const jobCount = jobs.length;
            fail = false;
            await coordinator.retryComposition(run.id, 0);
            await coordinator.reconcile(run.id);
            assert.equal((await h.jobs.list("local", { batchId: run.id })).length, jobCount);
            assert.equal((await h.runs.get("local", run.id)).candidates[0].status, "succeeded");
        } finally { await rm(h.directory, { recursive: true, force: true }); }
    });

    test("passes a generated candidate only after durable visual fidelity evaluation", async () => {
        const h = await harness();
        try {
            const run = await h.runs.create("local", { ...createInput(), max_in_flight: 1, candidates: [candidate(0, 1)] });
            const coordinator = new UniversalRemakeCoordinator(h.runs, h.jobs, { compose: async () => ({ artifactUri: "canvas-artifact:local/final" }) });
            await coordinator.reconcile(run.id);
            let jobs = await h.jobs.list("local", { batchId: run.id });
            const video = jobs.find((job) => job.kind === "viral-video");
            await h.jobs.update(video.id, { status: "succeeded", result: { artifactUri: "canvas-artifact:local/generated" } });
            await coordinator.reconcile(run.id);

            jobs = await h.jobs.list("local", { batchId: run.id });
            const fidelity = jobs.find((job) => job.kind === "universal-fidelity");
            assert.ok(fidelity);
            assert.deepEqual(fidelity.input.references.slice(0, 2), ["canvas-artifact:local/source-video", "canvas-artifact:local/generated"]);
            await h.jobs.update(fidelity.id, {
                status: "succeeded",
                result: { text: JSON.stringify({ factResults: [
                    { factId: "invariant-facing", status: "matched", issue: "" },
                    { factId: "fact-contact", status: "matched", issue: "" },
                    { factId: "continuity:unit-1:start:0", status: "matched", issue: "" },
                    { factId: "continuity:unit-1:end:0", status: "matched", issue: "" },
                ] }) },
            });
            await coordinator.reconcile(run.id);

            const finished = await h.runs.get("local", run.id);
            assert.equal(finished.status, "completed");
            assert.equal(finished.candidates[0].status, "succeeded");
            assert.equal(finished.candidates[0].fidelity_status, "passed");
            assert.equal(finished.candidates[0].fidelity_score, 100);
        } finally { await rm(h.directory, { recursive: true, force: true }); }
    });

    test("uses a fact-locked correction and stops after the configured fidelity retry limit", async () => {
        const h = await harness();
        try {
            const run = await h.runs.create("local", { ...createInput(), max_in_flight: 1, candidates: [candidate(0, 1)] });
            const coordinator = new UniversalRemakeCoordinator(h.runs, h.jobs, { compose: async () => ({ artifactUri: "canvas-artifact:local/final" }) });
            const failEvaluation = async (artifactUri) => {
                await coordinator.reconcile(run.id);
                const jobs = await h.jobs.list("local", { batchId: run.id });
                const video = jobs.find((job) => job.kind === "viral-video" && job.status === "queued");
                assert.ok(video);
                await h.jobs.update(video.id, { status: "succeeded", result: { artifactUri } });
                await coordinator.reconcile(run.id);
                const fidelity = (await h.jobs.list("local", { batchId: run.id })).find((job) => job.kind === "universal-fidelity" && job.status === "queued");
                assert.ok(fidelity);
                await h.jobs.update(fidelity.id, { status: "succeeded", result: { text: JSON.stringify({ factResults: [
                    { factId: "invariant-facing", status: "contradicted", issue: "主体变成正对镜头" },
                    { factId: "fact-contact", status: "matched", issue: "" },
                    { factId: "continuity:unit-1:start:0", status: "matched", issue: "" },
                    { factId: "continuity:unit-1:end:0", status: "matched", issue: "" },
                ] }) } });
                await coordinator.reconcile(run.id);
            };

            await failEvaluation("canvas-artifact:local/generated-1");
            let state = await h.runs.get("local", run.id);
            assert.equal(state.candidates[0].generation_retry_count, 1);
            let jobs = await h.jobs.list("local", { batchId: run.id });
            const retryVideo = jobs.find((job) => job.kind === "viral-video" && job.status === "queued");
            assert.match(retryVideo.input.prompt, /@角色1 始终背向镜头/);
            assert.doesNotMatch(retryVideo.input.prompt, /正对镜头/);

            await h.jobs.update(retryVideo.id, { status: "succeeded", result: { artifactUri: "canvas-artifact:local/generated-2" } });
            await coordinator.reconcile(run.id);
            jobs = await h.jobs.list("local", { batchId: run.id });
            const secondFidelity = jobs.find((job) => job.kind === "universal-fidelity" && job.status === "queued");
            await h.jobs.update(secondFidelity.id, { status: "succeeded", result: { text: JSON.stringify({ factResults: [
                { factId: "invariant-facing", status: "contradicted", issue: "方向仍然错误" },
                { factId: "fact-contact", status: "matched", issue: "" },
                { factId: "continuity:unit-1:start:0", status: "matched", issue: "" },
                { factId: "continuity:unit-1:end:0", status: "matched", issue: "" },
            ] }) } });
            await coordinator.reconcile(run.id);

            state = await h.runs.get("local", run.id);
            assert.equal(state.status, "failed");
            assert.equal(state.candidates[0].status, "fidelity-failed");
            assert.equal(state.candidates[0].fidelity_status, "failed");
            assert.equal(state.candidates[0].generation_retry_count, 1);
            assert.equal((await h.jobs.list("local", { batchId: run.id })).filter((job) => job.kind === "viral-video").length, 2);
        } finally { await rm(h.directory, { recursive: true, force: true }); }
    });
});
