import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { LocalStore } from "../src/local-store.ts";
import { createLocalViralBatchRepository } from "../src/viral-batch-repository.ts";

test("viral batches persist and deduplicate by user request id", async () => {
  const store = new LocalStore(join(mkdtempSync(join(tmpdir(), "viral-batch-repo-")), "gateway.json"));
  const repository = createLocalViralBatchRepository(store);
  const input = {
    canvas_id: "canvas-1", target_node_id: "results-1", generation_revision: 1,
    client_request_id: "batch-request-1", template_id: "template-1", candidate_count: 1000,
    model_id: "model-1", channel_id: "channel-1", max_in_flight: 3,
    input: { manifests: [{ index: 0, prompt: "candidate 1" }] },
  };
  const first = await repository.create("local", input);
  const duplicate = await repository.create("local", input);

  assert.equal(first.id, duplicate.id);
  assert.equal(first.candidate_count, 1000);
  assert.equal(first.status, "queued");
  assert.deepEqual((await repository.listActive()).map((batch) => batch.id), [first.id]);
});
