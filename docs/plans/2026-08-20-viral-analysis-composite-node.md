# Viral Analysis Composite Node Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将爆款复刻的拉片分析结果收敛为画布上的一个只读大节点，在节点内部按镜头展示代表帧、叙事、时间、镜头语言、影像处理和声音，并从节点底部直接进入现有“替换元素/生成提示词”流程。

**Architecture:** 保留现有 `ViralVideoAnalysis` 作为唯一结构化分析数据，在 Text 类型节点 metadata 中补充逐镜头代表帧数组。新增纯函数负责构造单节点数据，新增专用 React 内容组件负责只读呈现；画布节点渲染器识别该 metadata 后切换为复合节点。分析流程不再创建逐镜头图片节点、文本节点与连线，策划流程改为只依赖这一分析节点。

**Tech Stack:** React 18、TypeScript、Ant Design、Lucide React、现有无限画布组件、`canvasThemes`、Node `tsx --test`、Vite。

---

## 实施约束

- 不调用任何生图、视频或文本模型完成自动化验证，避免额外费用。
- 不改爆款复刻后续的“一套创意只生成一个成片”规则。
- 不做旧版多节点分析结果的数据迁移；新分析结果使用新结构，旧项目保持可打开。
- 复合节点完全只读，不提供节点内编辑、双击编辑或“编辑文字”入口。
- 代表帧来自用户上传的原视频，不生成新图片。
- 所有颜色、边框和文字层级使用 `canvasThemes`，兼容深色/浅色画布。
- 当前工作树包含用户已有改动。实施时只暂存本计划列出的文件；提交步骤仅在用户明确授权后执行。

## Task 1：先用测试固定“一个分析结果只创建一个节点”的数据契约

**Files:**

- Create: `web/tests/viral-video-analysis-node.test.mjs`
- Create: `web/src/lib/canvas/viral-video-analysis-node.ts`
- Modify: `web/src/types/canvas.ts`

**Step 1：写失败测试**

在 `viral-video-analysis-node.test.mjs` 中覆盖以下行为：

1. 两个镜头的分析只返回一个 `CanvasNodeType.Text` 节点。
2. 节点尺寸固定为适合复合面板的默认值（宽 `1320`、高 `760`）。
3. `metadata.viralVideoAnalysis` 保留完整结构化结果。
4. `metadata.viralVideoShotFrames` 按 `shotIndex` 保存代表帧，允许某个镜头没有成功提取帧。
5. 工作流 patch 只保存 `analysisNodeId`，不再产生 `analysisShotNodeIds`。

建议纯函数签名：

```ts
buildViralVideoAnalysisNode({
  id,
  title,
  position,
  analysis,
  analysisPrompt,
  shotFrames,
})
```

另提供：

```ts
buildViralVideoAnalyzedWorkflowPatch(analysisNodeId)
```

**Step 2：运行测试并确认 RED**

Run:

```powershell
..\gateway\node_modules\.bin\tsx.CMD --test tests\viral-video-analysis-node.test.mjs
```

Workdir: `web`

Expected: 因 helper 和 metadata 类型尚不存在而失败。

**Step 3：补最小类型与纯函数**

在 `web/src/types/canvas.ts` 新增：

```ts
export type ViralVideoShotFrame = {
  shotIndex: number;
  content?: string;
  storageKey?: string;
  naturalWidth?: number;
  naturalHeight?: number;
  mimeType?: string;
};
```

并为 `CanvasNodeMetadata` 增加：

```ts
viralVideoShotFrames?: ViralVideoShotFrame[];
```

在新 helper 中构造唯一分析节点：

- `content` 只保留简短可检索摘要，不作为 UI 主体。
- metadata 保存完整 `viralVideoAnalysis`、原始 `viralVideoAnalysisPrompt` 和代表帧数组。
- 节点为 Text 类型，但依靠 metadata 触发专用只读渲染。
- workflow patch 清理策划/生成链 ID，并进入 `analyzed`。

**Step 4：运行测试并确认 GREEN**

Run 同 Step 2。

Expected: 全部通过。

**Step 5：可选提交（仅用户授权后）**

```powershell
git add web/src/types/canvas.ts web/src/lib/canvas/viral-video-analysis-node.ts web/tests/viral-video-analysis-node.test.mjs
git commit -m "feat: define composite viral analysis node"
```

## Task 2：实现只读复合节点 UI

**Files:**

- Create: `web/src/components/canvas/viral-video-analysis-node-content.tsx`
- Modify: `web/tests/viral-video-analysis-node.test.mjs`

**Step 1：扩展纯数据测试**

为 UI 使用的行数据整理函数增加测试，确保：

- 镜头按 `index` 排序。
- 代表帧按 `shotIndex` 精确匹配，不按数组位置误配。
- 开始、结束、时长缺失时有稳定兜底文本。
- 场景、角色、对白、运镜、构图、景深、光影、色彩、音乐、音效、镜头目的均能落入对应栏目。

**Step 2：运行测试并确认 RED**

Run:

```powershell
..\gateway\node_modules\.bin\tsx.CMD --test tests\viral-video-analysis-node.test.mjs
```

Expected: 因行数据 helper 尚不存在而失败。

**Step 3：实现复合内容组件**

组件接收：

```ts
type Props = {
  analysis: ViralVideoAnalysis;
  shotFrames: ViralVideoShotFrame[];
  disabled?: boolean;
  onNext: () => void;
};
```

布局要求：

- 根容器 `h-full min-h-0`，分为固定头部、可滚动镜头列表和固定底部操作区。
- 头部显示：标题、总时长、画幅、镜头数量、开头钩子/复刻策略摘要。
- 每个镜头一整行，使用六列：
  1. 代表帧与镜头描述；
  2. 叙事要素（场景、角色、对白、作用）；
  3. 时间（开始、结束、时长）；
  4. 镜头语言（景别、构图、机位、运镜、焦距/景深）；
  5. 影像处理（光影、色调、剪辑节奏、质感）；
  6. 声音（音乐、音效、对白、叙事功能）。
- 节点内部纵向滚动；横向空间不足时内容区保留最小宽度并允许内部横滚，不能把整个画布撑坏。
- `wheel`、滚动条和按钮事件阻止冒泡，避免操作内部内容时触发画布缩放、拖动或取消选择。
- 代表帧缺失时显示中性占位，不报错、不阻塞下一步。
- 底部唯一主按钮文案为“下一步：替换元素”，点击调用 `onNext`。
- 只展示，不使用 textarea、contentEditable 或编辑按钮。
- 颜色全部来自当前 `canvasThemes`/主题上下文；图标使用现有 Lucide React。

**Step 4：运行测试并确认 GREEN**

Run 同 Step 2。

Expected: 全部通过。

**Step 5：可选提交（仅用户授权后）**

```powershell
git add web/src/components/canvas/viral-video-analysis-node-content.tsx web/src/lib/canvas/viral-video-analysis-node.ts web/tests/viral-video-analysis-node.test.mjs
git commit -m "feat: render read-only viral shot analysis panel"
```

## Task 3：让画布节点识别复合分析内容并彻底禁用编辑

**Files:**

- Modify: `web/src/components/canvas/canvas-node.tsx`
- Modify: `web/src/pages/canvas/project.tsx`
- Modify: `web/tests/viral-video-analysis-node.test.mjs`

**Step 1：写静态集成断言并确认 RED**

在测试中读取源文件并断言：

- Text 节点带 `viralVideoAnalysis` 时优先使用 `renderNodeContent`。
- 该节点不会响应 Text 的 `editRequestNonce` 进入编辑态。
- 项目页为分析节点渲染 `ViralVideoAnalysisNodeContent`。
- 项目页的 `openTextEditor`/工具栏入口会拒绝分析节点。

Run:

```powershell
..\gateway\node_modules\.bin\tsx.CMD --test tests\viral-video-analysis-node.test.mjs
```

Expected: 新静态断言失败。

**Step 2：接入专用渲染**

在 `canvas-node.tsx`：

- Text renderer 检测 `node.metadata?.viralVideoAnalysis`。
- 命中时直接返回 `renderNodeContent(node)`，不进入普通文本/textarea 分支。
- 双击、编辑 nonce、键盘编辑和 hover toolbar 的“编辑文字”逻辑都跳过该节点。
- 不影响普通 Text 节点和 Config 节点。

在 `project.tsx` 的 `renderNodeContent` 回调中：

- 分析节点渲染新组件。
- `analysis`、`shotFrames` 从当前节点 metadata 读取。
- `onNext` 复用现有 `generateViralRemakePrompts`。
- 策划或生成正在运行时禁用按钮，避免重复启动。
- Config 节点继续渲染现有 `CanvasConfigNodePanel`。

**Step 3：运行测试并确认 GREEN**

Run 同 Step 1。

Expected: 全部通过。

**Step 4：可选提交（仅用户授权后）**

```powershell
git add web/src/components/canvas/canvas-node.tsx web/src/pages/canvas/project.tsx web/tests/viral-video-analysis-node.test.mjs
git commit -m "feat: integrate composite analysis node renderer"
```

## Task 4：把分析阶段从多节点改成单节点

**Files:**

- Modify: `web/src/pages/canvas/project.tsx`
- Modify: `web/src/types/canvas.ts`
- Modify: `web/tests/viral-video-analysis-node.test.mjs`

**Step 1：增加失败断言**

增加集成断言：

- 分析完成后不再创建 `shotTextNode`、逐镜头 Image 节点或逐镜头连线。
- 每个镜头仍调用 `captureVideoFrame`，但结果只写入 `viralVideoShotFrames`。
- 新分析只追加一个复合 Text 节点，以及源视频到该节点的一条连接。
- workflow 不再写 `analysisShotNodeIds`。

**Step 2：运行测试并确认 RED**

Run:

```powershell
..\gateway\node_modules\.bin\tsx.CMD --test tests\viral-video-analysis-node.test.mjs
```

Expected: 当前多节点实现导致断言失败。

**Step 3：重写分析结果落图逻辑**

在现有分析完成回调中：

1. 解析并校验 `analysis.shots` 至少一个镜头。
2. 以受控并发或顺序提取每个镜头的代表帧。
3. 帧提取/上传单个失败时记录缺失占位，不让整次拉片结果失败。
4. 使用 Task 1 helper 构造一个宽 `1320`、高 `760` 的分析节点。
5. 只创建 `source video -> analysis composite` 一条连接。
6. 画布选择只指向该分析节点，并将视口定位到它。
7. workflow 写入唯一 `analysisNodeId`，不再维护 `analysisShotNodeIds`。

删除已无用途的逐镜头节点位置计算、节点数组、连接数组和标题格式化代码，但保留仍被信息弹窗或日志使用的 formatter。

**Step 4：运行测试并确认 GREEN**

Run 同 Step 2。

Expected: 全部通过。

**Step 5：可选提交（仅用户授权后）**

```powershell
git add web/src/pages/canvas/project.tsx web/src/types/canvas.ts web/tests/viral-video-analysis-node.test.mjs
git commit -m "refactor: store viral analysis in one canvas node"
```

## Task 5：让后续提示词策划只依赖复合分析节点

**Files:**

- Modify: `web/src/pages/canvas/project.tsx`
- Modify: `web/tests/viral-video-analysis-node.test.mjs`

**Step 1：增加失败测试**

断言策划启动条件变为：

- `analysisNodeId` 对应节点存在。
- 节点含完整 `viralVideoAnalysis`。
- 不再校验 `analysisShotNodeIds.length`。
- 不再报“逐镜头拉片节点不完整，请重新分析”。
- 创建镜头提示词、分段提示词和 execution master 时，都从复合分析节点连出；禁止按不存在的逐镜头节点索引连线。

**Step 2：运行测试并确认 RED**

Run:

```powershell
..\gateway\node_modules\.bin\tsx.CMD --test tests\viral-video-analysis-node.test.mjs
```

Expected: 旧的 `analysisShotNodeIds` 校验和连线仍存在，测试失败。

**Step 3：修改策划流程**

- 删除对 `workflow.analysisShotNodeIds` 的完整性要求。
- 结构化镜头数据始终读取 `analysisNode.metadata.viralVideoAnalysis.shots`。
- 代表帧仅供 UI 展示，不作为策划成功的硬条件。
- 所有新 prompt/record/master 节点连接以唯一分析节点作为上游。
- 保留现有 planId、可编辑 prompt、取消保护、一套创意一个最终视频等契约。
- “下一步：替换元素”和顶部“生成分镜提示词”调用同一函数，避免两套逻辑。

**Step 4：运行相关回归测试**

Run:

```powershell
..\gateway\node_modules\.bin\tsx.CMD --test tests\viral-video-analysis-node.test.mjs tests\viral-video-generation.test.mjs
```

Expected: 两个测试文件全部通过。

**Step 5：可选提交（仅用户授权后）**

```powershell
git add web/src/pages/canvas/project.tsx web/tests/viral-video-analysis-node.test.mjs
git commit -m "refactor: plan viral remake from composite analysis"
```

## Task 6：构建、视觉验收与项目记录

**Files:**

- Modify: `docs/content/docs/progress/todo.mdx`
- Modify: `docs/content/docs/progress/pending-test.mdx`

**Step 1：运行完整、无模型费用的自动化检查**

Run:

```powershell
..\gateway\node_modules\.bin\tsx.CMD --test tests\viral-video-analysis-node.test.mjs tests\viral-video-generation.test.mjs
npm run build
```

Workdir: `web`

Expected:

- 测试全部通过。
- Vite production build 成功。
- 无 TypeScript 错误。

**Step 2：浏览器视觉验收（禁止触发付费生成）**

在 `http://127.0.0.1:3000` 使用已有分析 metadata 或本地无费用 fixture 检查：

1. 画布上只显示一个大分析节点。
2. 深色、浅色主题下文字和边框清晰。
3. 节点内部滚动不会缩放/拖动画布。
4. 各镜头六列信息对应正确，缺帧时占位稳定。
5. 双击节点、按编辑快捷键或点击工具栏均不能编辑内容。
6. 底部按钮固定可见，点击只进入现有策划流程；若没有安全的本地 mock，则只验证 disabled/事件接线，不真正调用模型。
7. 缩放到常见比例后，节点标题、镜头数量、时间和按钮仍可辨认。

**Step 3：更新项目记录**

在 `todo.mdx` 记录已完成项：

- 爆款复刻拉片结果改为单一只读复合节点。
- 逐镜头代表帧进入 metadata，不再创建图片/文本子节点。
- 后续策划只依赖复合分析节点。

在 `pending-test.mdx` 记录仍需真实模型/真实长视频验证的项目：

- 超长视频镜头数较多时的内部滚动与内存占用。
- 代表帧上传失败/断网下的占位体验。
- 真实模型返回缺字段时的栏目兜底。

**Step 4：检查变更边界**

Run:

```powershell
git status --short
git diff -- web/src/types/canvas.ts web/src/lib/canvas/viral-video-analysis-node.ts web/src/components/canvas/viral-video-analysis-node-content.tsx web/src/components/canvas/canvas-node.tsx web/src/pages/canvas/project.tsx web/tests/viral-video-analysis-node.test.mjs docs/content/docs/progress/todo.mdx docs/content/docs/progress/pending-test.mdx
```

Expected: 只有本计划列出的文件包含本功能改动；用户原有其他修改未被覆盖。

**Step 5：可选最终提交（仅用户授权后）**

```powershell
git add docs/content/docs/progress/todo.mdx docs/content/docs/progress/pending-test.mdx
git commit -m "docs: record composite viral analysis workflow"
```

## 完成标准

- 一次拉片分析在画布上只生成一个只读节点。
- 节点内按镜头显示完整六类信息与代表帧。
- 不存在逐镜头图片节点、文本节点或对应连线。
- 节点不能编辑，内部可独立滚动。
- 底部“下一步：替换元素”复用现有策划入口。
- 后续策划与“一套创意只生成一个成片”逻辑不回退。
- 新增测试通过，Vite production build 通过。
- 验证过程不产生模型费用。
