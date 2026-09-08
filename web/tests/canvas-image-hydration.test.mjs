import assert from "node:assert/strict";
import test from "node:test";

const hydration = await import("../src/lib/canvas/canvas-image-hydration.ts").catch(() => ({}));

test("canvas artifact images replace a stale LAN URL with the current gateway URL", async () => {
    const calls = [];
    const content = await hydration.resolveCanvasImageContent(
        {
            canvasId: "canvas-1",
            storageKey: "canvas-artifact:local/image-1",
            content: "http://192.168.31.135:8788/v1/canvas-artifacts/content?stale=1",
        },
        {
            resolveStoredImage: async () => "",
            resolveCanvasArtifact: async (canvasId, storageKey) => {
                calls.push([canvasId, storageKey]);
                return "http://127.0.0.1:8788/v1/canvas-artifacts/content?fresh=1";
            },
        },
    );

    assert.equal(content, "http://127.0.0.1:8788/v1/canvas-artifacts/content?fresh=1");
    assert.deepEqual(calls, [["canvas-1", "canvas-artifact:local/image-1"]]);
});

test("local canvas artifacts are always canonicalized instead of trusting their saved host", () => {
    assert.equal(
        hydration.shouldRefreshCanvasArtifactUrl(
            "canvas-artifact:local/image-1",
            "http://192.168.1.8:8788/v1/canvas-artifacts/content?canvasId=canvas-1",
        ),
        true,
    );
    assert.equal(hydration.shouldRefreshCanvasArtifactUrl("image:image-1", "blob:current"), false);
});
