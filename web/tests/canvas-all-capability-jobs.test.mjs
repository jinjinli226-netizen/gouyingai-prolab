import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("generic canvas text, image, video and audio branches submit Gateway jobs", async () => {
  const source = await readFile(new URL("../src/pages/canvas/project.tsx", import.meta.url), "utf8");
  const handleStart = source.indexOf("const handleGenerateNode");
  const imageStart = source.indexOf('if (mode === "image")', handleStart);
  const videoStart = source.indexOf('if (mode === "video")', imageStart);
  const audioStart = source.indexOf('if (mode === "audio")', videoStart);
  const textStart = source.indexOf("const isConfigNode = sourceNode?.type", audioStart);
  const handleEnd = source.indexOf("useEffect(() => {\n        generateNodeRef.current", textStart);
  const imageBranch = source.slice(imageStart, videoStart);
  const videoBranch = source.slice(videoStart, audioStart);
  const audioBranch = source.slice(audioStart, textStart);
  const textBranch = source.slice(textStart, handleEnd);

  for (const [kind, branch] of [["image", imageBranch], ["video", videoBranch], ["audio", audioBranch], ["text", textBranch]]) {
    assert.match(branch, new RegExp(`kind: "${kind}"`));
    assert.match(branch, /createCanvasJob/);
  }
  assert.doesNotMatch(imageBranch, /requestGeneration|requestEdit/);
  assert.doesNotMatch(videoBranch, /requestVideoGeneration/);
  assert.doesNotMatch(audioBranch, /requestAudioGeneration/);
  assert.doesNotMatch(textBranch, /requestImageQuestion/);
});
