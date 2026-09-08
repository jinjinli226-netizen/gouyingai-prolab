import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const artifactModule = await import("../src/canvas-artifact-routes.ts").catch(() => ({}));
const { createLocalGatewayApp } = await import("../src/local-server.ts");
const { LocalStore } = await import("../src/local-store.ts");

async function withGateway(run) {
  const directory = mkdtempSync(join(tmpdir(), "gouyingai-artifacts-"));
  const store = new LocalStore(join(directory, "gateway.json"));
  const server = createLocalGatewayApp(store).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  try {
    await run({ baseUrl: `http://127.0.0.1:${address.port}`, store });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("local canvas artifact upload is durable, opaque and owner scoped", async () => {
  await withGateway(async ({ baseUrl, store }) => {
    const form = new FormData();
    form.append("canvasId", "canvas-1");
    form.append("file", new File([new Uint8Array([1, 2, 3, 4])], "reference.png", { type: "image/png" }));
    const response = await fetch(`${baseUrl}/v1/canvas-artifacts`, { method: "POST", body: form });
    assert.equal(response.status, 201);
    const artifact = (await response.json()).data;
    assert.match(artifact.uri, /^canvas-artifact:/);
    assert.doesNotMatch(artifact.uri, /base64|AQID/);
    assert.equal(artifact.bytes, 4);
    assert.match(artifact.checksum, /^[a-f0-9]{64}$/);

    const stored = store.readCanvasArtifact("local", "canvas-1", artifact.uri);
    assert.deepEqual([...stored.bytes], [1, 2, 3, 4]);
    assert.equal(store.readCanvasArtifact("another-user", "canvas-1", artifact.uri), undefined);
    assert.equal(store.readCanvasArtifact("local", "another-canvas", artifact.uri), undefined);

    const signed = await fetch(`${baseUrl}/v1/canvas-artifacts/url?canvasId=canvas-1&uri=${encodeURIComponent(artifact.uri)}`);
    assert.equal(signed.status, 200);
    const contentUrl = (await signed.json()).data.url;
    const content = await fetch(`${baseUrl}${contentUrl}`);
    assert.deepEqual([...new Uint8Array(await content.arrayBuffer())], [1, 2, 3, 4]);
  });
});

test("canvas artifact upload rejects unsupported MIME types", async () => {
  await withGateway(async ({ baseUrl }) => {
    const form = new FormData();
    form.append("canvasId", "canvas-1");
    form.append("file", new File(["<html></html>"], "payload.html", { type: "text/html" }));
    const response = await fetch(`${baseUrl}/v1/canvas-artifacts`, { method: "POST", body: form });
    assert.equal(response.status, 415);
  });
});

test("artifact URI parsing rejects paths outside the owning canvas", () => {
  assert.equal(artifactModule.isOwnedCanvasArtifactPath("user-1", "canvas-1", "user-1/canvas/canvas-1/inputs/file"), true);
  assert.equal(artifactModule.isOwnedCanvasArtifactPath("user-1", "canvas-1", "user-1/canvas/canvas-1/outputs/job/file"), true);
  assert.equal(artifactModule.isOwnedCanvasArtifactPath("user-1", "canvas-1", "user-2/canvas/canvas-1/inputs/file"), false);
  assert.equal(artifactModule.isOwnedCanvasArtifactPath("user-1", "canvas-1", "user-1/canvas/../canvas-2/inputs/file"), false);
});
