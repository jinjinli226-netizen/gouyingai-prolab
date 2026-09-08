import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const read = (file) => readFile(path.join(process.cwd(), file), "utf8");

test("viral remake exposes five focused canvas card concepts", async () => {
  const [requirements, replacements, template, batch, results, project] = await Promise.all([
    read("src/components/canvas/viral-video-requirements-node-content.tsx"),
    read("src/components/canvas/viral-video-replacement-library-node-content.tsx"),
    read("src/components/canvas/viral-video-template-node-content.tsx"),
    read("src/components/canvas/viral-video-batch-node-content.tsx"),
    read("src/components/canvas/viral-video-results-node-content.tsx"),
    read("src/pages/canvas/project.tsx"),
  ]);
  assert.match(requirements, /参考视频与复刻要求/);
  assert.match(replacements, /复刻素材与对象识别/);
  assert.match(replacements, /可选/);
  assert.match(template, /唯一复刻母版/);
  assert.match(batch, /批量生产/);
  assert.match(batch, /max=\{1000\}/);
  assert.match(results, /批次结果/);
  assert.match(project, /ViralVideoBatchNodeContent/);
  assert.match(project, /ViralVideoResultsNodeContent/);
  assert.match(project, /buildViralVideoMasterPrompt\(plan\.masterPrompt/);
});

test("representative frames have fallback states and no legacy variant language remains", async () => {
  const analysis = await read("src/components/canvas/viral-video-analysis-node-content.tsx");
  const project = await read("src/pages/canvas/project.tsx");
  assert.match(analysis, /代表帧加载失败/);
  assert.doesNotMatch(project, /生成 14 个镜头变体/);
  assert.doesNotMatch(project, /ViralVideoVariantNodeContent/);
});
