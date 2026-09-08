import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createLocalCanvasJobRepository } from "../src/canvas-job-repository.ts";
import { CanvasJobRunner } from "../src/canvas-job-runner.ts";
import { createLocalGatewayApp } from "../src/local-server.ts";
import { LocalStore } from "../src/local-store.ts";

test("an accepted canvas job finishes and remains recoverable without a browser connection", async () => {
  const directory = mkdtempSync(join(tmpdir(), "gouyingai-detached-job-"));
  const file = join(directory, "gateway.json");
  const store = new LocalStore(file);
  const server = createLocalGatewayApp(store).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const runner = new CanvasJobRunner({
    repository: createLocalCanvasJobRepository(store),
    handler: async ({ job }) => {
      await new Promise((resolve) => setTimeout(resolve, 15));
      return {
        result: { text: "finished in gateway" },
        result_patch: {
          canvasId: job.canvas_id,
          nodeId: job.target_node_id,
          jobId: job.id,
          generationRevision: job.generation_revision,
          nodePatch: { metadata: { content: "finished in gateway" } },
        },
      };
    },
    settings: {
      globalConcurrency: 2,
      capabilityConcurrency: {},
      channelConcurrency: {},
      leaseSeconds: 60,
      heartbeatIntervalMs: 10,
      pollIntervalMs: 100,
      claimBatch: 4,
    },
  });

  try {
    const response = await fetch(`${baseUrl}/v1/canvas-jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        canvasId: "canvas-detached",
        targetNodeId: "node-detached",
        generationRevision: 1,
        clientRequestId: "request-detached",
        kind: "text",
        modelId: "model-fixed",
        channelId: "channel-fixed",
        input: { prompt: "run after the request ends" },
      }),
    });
    assert.equal(response.status, 201);
    const created = (await response.json()).data;

    // The HTTP request is over. From here the runner owns the work.
    await runner.runOnce();
    await runner.waitForIdle();

    const reloaded = new LocalStore(file).getCanvasJob("local", created.id);
    assert.equal(reloaded.status, "succeeded");
    assert.equal(reloaded.result_patch.jobId, created.id);
    assert.equal(reloaded.result_patch.nodeId, "node-detached");
  } finally {
    runner.stop();
    await new Promise((resolve) => server.close(resolve));
  }
});
