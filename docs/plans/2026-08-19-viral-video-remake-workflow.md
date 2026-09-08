# Viral Video Remake Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an independent “爆款复刻” infinite-canvas workflow that analyzes an uploaded video shot by shot, generates editable remake prompts, and creates one complete or multiple segmented videos.

**Architecture:** Add a new persisted canvas workflow kind instead of extending the five existing ecommerce categories. Keep pure prompt/schema/layout logic in a dedicated workflow module, use existing browser media storage and model services, and let the canvas page orchestrate three explicit stages: analysis, prompt generation, and video generation.

**Tech Stack:** React 19, TypeScript, Ant Design, Zustand canvas store, localForage media storage, existing OpenAI-compatible text/video services.

---

## Project constraints

- Work in `C:/Users/25941/Documents/prolab/prolab` and preserve all unrelated user changes.
- Do not restore frontend channel editing; text and video models continue to come from the Gateway catalog.
- Do not add a backend endpoint or database table.
- Do not run build, typecheck, unit tests, or model calls; repository instructions assign those checks to the user.
- Do not change Git author configuration automatically. The repository currently has no author identity, so commit checkpoints stay optional until the user configures Git.
- Keep the existing five ecommerce workflow implementations unchanged except for sharing general canvas helpers already present.

## Task 1: Add workflow state and pure workflow module

**Files:**

- Modify: `web/src/types/canvas.ts`
- Create: `web/src/lib/canvas/viral-video-remake-workflow.ts`

**Step 1: Add the persisted workflow type**

Add these types next to the current ecommerce workflow types:

```ts
export type ViralVideoRemakePhase = "idle" | "analyzing" | "analyzed" | "planning" | "planned" | "generating";

export type ViralVideoRemakeWorkflowState = {
    kind: "viral-video-remake";
    sourceVideoNodeId: string;
    productNodeId: string;
    replacementBrief: string;
    batchCount: number;
    phase: ViralVideoRemakePhase;
    analysisNodeId?: string;
    analysisShotNodeIds?: string[];
    promptNodeIds?: string[];
    masterPromptNodeId?: string;
    outputNodeIds?: string[];
};
```

Add `ViralVideoRemakeWorkflowState` to `CanvasWorkflowState` without changing `EcommerceVideoCategory`.

**Step 2: Define structured analysis and prompt-plan types**

In the new workflow module define:

```ts
export type ViralVideoShot = {
    index: number;
    startSeconds: number;
    endSeconds: number;
    durationSeconds: number;
    frameDescription: string;
    scene: string;
    characters: string;
    action: string;
    dialogue: string;
    visibleText: string;
    narrativePurpose: string;
    shotSize: string;
    composition: string;
    cameraAngle: string;
    lensAndFocus: string;
    cameraMovement: string;
    lightingAndColor: string;
    transition: string;
    musicAndSound: string;
    replaceableElements: string;
    structuralMustKeep: string;
};

export type ViralVideoAnalysis = {
    title: string;
    durationSeconds: number;
    aspectRatio: string;
    hook: string;
    narrativeStructure: string;
    editRhythm: string;
    visualStyle: string;
    soundStrategy: string;
    transferableCore: string;
    shots: ViralVideoShot[];
};

export type ViralVideoPromptPlan = {
    title: string;
    originalityRules: string;
    productContinuity: string;
    masterPrompt: string;
    shotPrompts: Array<{ index: number; prompt: string }>;
    segments: Array<{
        title: string;
        shotIndexes: number[];
        durationSeconds: number;
        prompt: string;
    }>;
};
```

**Step 3: Build the initial project**

Implement `buildViralVideoRemakeProject()` using existing `NODE_DEFAULT_SIZE` and `nanoid()`:

- Create a required empty `CanvasNodeType.Video` node titled `上传爆款参考视频`.
- Create an optional empty `CanvasNodeType.Image` node titled `上传新商品图（可选）`.
- Position the two nodes vertically on the left so neither overlaps the top toolbar.
- Set workflow `phase: "idle"`, `replacementBrief: ""`, and `batchCount: 1`.
- Return a viewport consistent with `buildEcommerceWorkflowProject()`.

**Step 4: Add actual progress labels**

Export a fixed label array for display only:

```ts
export const viralVideoAnalysisStages = [
    "时间轴信息提取：正在标注每个镜头的开始时间、结束时间与时长。",
    "叙事要素解析：正在识别场景、可见角色、对白与关键叙事信息。",
    "镜头语言解构：正在检查景别、构图、画框、机位与运镜方式。",
    "视觉风格提炼：正在分析光影、色彩、景深、剪辑节奏与整体观感。",
    "声音与叙事洞察：正在检查音乐、音效、镜头目的与故事推进。",
    "拉片结果整理：正在校验时间轴连续性并创建画布节点。",
];
```

Do not encode fake per-category completion into the analysis result.

**Step 5: Static review**

Use `rg` only to confirm the new workflow kind appears in the type union and builder. Do not run TypeScript or build commands.

**Optional commit checkpoint:**

```bash
git add web/src/types/canvas.ts web/src/lib/canvas/viral-video-remake-workflow.ts
git commit -m "feat: add viral video remake workflow model"
```

## Task 2: Implement analysis prompts, parsers, and layout records

**Files:**

- Modify: `web/src/lib/canvas/viral-video-remake-workflow.ts`

**Step 1: Build the analysis prompt**

Implement:

```ts
export function buildViralVideoAnalysisPrompt(durationSeconds?: number): string;
```

The prompt must:

- Require complete-video inspection from first frame to last frame.
- State that shot count and timestamps come from the real edit, not a fixed template.
- Request all six analysis dimensions from the approved design.
- Require seconds as numbers and `shots` sorted by `startSeconds`.
- Require empty strings rather than invented dialogue, text, claims, people, or brands.
- Return one JSON object with exactly the `ViralVideoAnalysis` shape.
- Include the browser-read duration as a consistency hint when available, not as permission to invent cuts.

**Step 2: Parse and validate analysis JSON**

Implement:

```ts
export function parseViralVideoAnalysis(content: string, sourceDurationSeconds?: number): ViralVideoAnalysis;
```

Reuse the existing tolerant pattern that strips optional JSON code fences and extracts the first outer object. Validate every required string and number.

Timeline validation rules:

```ts
if (!shots.length) throw new Error("拉片结果没有返回镜头");
if (shot.endSeconds <= shot.startSeconds) throw new Error(`镜头 ${shot.index} 的时间范围无效`);
if (current.startSeconds < previous.endSeconds - 0.05) throw new Error(`镜头 ${current.index} 与上一镜头时间重叠`);
if (sourceDurationSeconds && last.endSeconds > sourceDurationSeconds + 0.5) throw new Error("拉片时间轴超过原视频时长");
```

Normalize `durationSeconds` from `endSeconds - startSeconds` instead of trusting inconsistent model output.

**Step 3: Format analysis nodes**

Implement:

```ts
export function formatViralVideoAnalysisSummary(analysis: ViralVideoAnalysis, requestPrompt: string): string;
export function formatViralVideoShotAnalysis(shot: ViralVideoShot): string;
```

The summary must expose the complete AI request prompt at the bottom. Each shot record must show timing, narrative, camera, image treatment, sound, replaceable elements, and structural must-keep fields with readable Markdown headings.

**Step 4: Build the second-stage prompt**

Implement:

```ts
export function buildViralVideoPromptPlannerPrompt(input: {
    analysis: ViralVideoAnalysis;
    replacementBrief: string;
    hasProductImage: boolean;
    maxSegmentSeconds: number;
    variantIndex: number;
    totalVariants: number;
    generationSeed: number;
}): string;
```

The prompt must return `ViralVideoPromptPlan`, with exactly one prompt for each analysis shot. It must:

- Keep timing, shot purpose, camera language, rhythm, sound cues, and transitions.
- Invent original people, locations, clothing, visible text, music, and sound treatment.
- Never reproduce original names, faces, brands, logos, watermarks, slogans, IP, or exact dialogue.
- When a product image is attached, use it as the sole product appearance source and preserve shape, color, packaging, logo, and visible text.
- When no product image is attached, describe an unbranded generic object and not infer the original brand.
- Group adjacent shots into ordered segments whose `durationSeconds` is no more than `maxSegmentSeconds`.
- Avoid splitting inside one shot.
- Produce a complete `masterPrompt` and complete prompts for every segment.

**Step 5: Parse and validate the prompt plan**

Implement:

```ts
export function parseViralVideoPromptPlan(content: string, analysis: ViralVideoAnalysis, maxSegmentSeconds: number): ViralVideoPromptPlan;
```

Validate:

- `shotPrompts.length === analysis.shots.length`.
- Each analysis shot index appears once in `shotPrompts`.
- Every shot index appears once across ordered `segments`.
- Segment duration is positive and no more than the chosen model limit.
- `masterPrompt`, segment prompts, originality rules, and product continuity are non-empty.

Do not build a default plan when parsing fails.

**Step 6: Add readable prompt records**

Implement formatters for individual shot prompts and master/segment prompts. Every node must display the actual prompt submitted to video generation.

**Optional commit checkpoint:**

```bash
git add web/src/lib/canvas/viral-video-remake-workflow.ts
git commit -m "feat: add viral video analysis and prompt planning"
```

## Task 3: Add representative-frame extraction

**Files:**

- Create: `web/src/lib/video-frame.ts`

**Step 1: Implement one-frame capture**

Add:

```ts
export async function captureVideoFrame(videoUrl: string, timeSeconds: number): Promise<Blob>;
```

Implementation requirements:

- Create an off-DOM `<video>` with `muted = true`, `preload = "auto"`, and the supplied local URL.
- Wait for `loadedmetadata`.
- Clamp capture time between `0` and `duration - 0.01`.
- Seek and wait for `seeked`.
- Draw into a canvas using the video's natural dimensions, scaled so the longest edge is at most 960 pixels.
- Return a JPEG Blob using `canvas.toBlob(..., "image/jpeg", 0.82)`.
- Remove event handlers and clear `video.src` in `finally`.
- Throw `代表帧提取失败` rather than silently returning an empty image.

**Step 2: Keep frame capture non-blocking for analysis**

The canvas orchestrator will catch capture failure per shot and still keep that shot's text analysis. Frame extraction must never invalidate a valid AI analysis response.

**Optional commit checkpoint:**

```bash
git add web/src/lib/video-frame.ts
git commit -m "feat: capture representative video frames"
```

## Task 4: Add the dedicated entry and toolbar

**Files:**

- Modify: `web/src/pages/ecommerce/index.tsx`
- Create: `web/src/components/canvas/viral-video-remake-canvas-bar.tsx`

**Step 1: Add the entry**

Import `buildViralVideoRemakeProject` and a video-scan icon from `lucide-react`. Add `openViralVideoRemakeWorkflow()` beside the existing open handlers:

```ts
const openViralVideoRemakeWorkflow = () => {
    if (!hydrated) return void message.info("画布数据正在加载，请稍候");
    const id = importProject(buildViralVideoRemakeProject());
    navigate(`/canvas/${id}`);
};
```

Render a visually separate “爆款复刻” row in the video workflow section. Do not add it to `ecommerceWorkflowDefinitions`, because it has a different workflow kind and input sequence.

**Step 2: Define toolbar props**

The toolbar receives:

```ts
type ViralVideoRemakeCanvasBarProps = {
    workflow: ViralVideoRemakeWorkflowState;
    hasSourceVideo: boolean;
    hasProductImage: boolean;
    running: boolean;
    stageLabel: string;
    completed: number;
    total: number;
    totalVideoTasks: number;
    onWorkflowChange: (patch: Partial<ViralVideoRemakeWorkflowState>) => void;
    onUploadSource: () => void;
    onUploadProduct: () => void;
    onAnalyze: () => void;
    onGeneratePrompts: () => void;
    onGenerateVideos: () => void;
};
```

**Step 3: Implement stage-aware controls**

Use `canvasThemes` and the existing toolbar placement. Show:

- Tag `爆款复刻`.
- Source upload/change button.
- Optional product upload/change button.
- Popover or compact input for `replacementBrief`.
- `InputNumber` for variant count, 1-100.
- One primary action determined by `workflow.phase`:
  - `idle` → `开始拉片分析`
  - `analyzed` → `生成分镜提示词`
  - `planned` → `一键生成视频`
- `重新分析` and `重新生成提示词` as secondary actions after later stages.
- Progress bar and stage label while running.
- Warning and disabled generation when `totalVideoTasks > 100`.

Do not display percentage as model reasoning progress. `completed / total` is only the workflow task count.

**Step 4: Preserve the canvas theme**

Do not hard-code an Oiioii black panel. Match the current canvas light/dark toolbar and node colors while preserving the requested information hierarchy.

**Optional commit checkpoint:**

```bash
git add web/src/pages/ecommerce/index.tsx web/src/components/canvas/viral-video-remake-canvas-bar.tsx
git commit -m "feat: add viral remake entry and toolbar"
```

## Task 5: Integrate source upload and AI analysis in the canvas page

**Files:**

- Modify: `web/src/pages/canvas/project.tsx`

**Step 1: Add imports and local execution state**

Import the new toolbar, workflow functions, `mediaToDataUrl`, `captureVideoFrame`, and existing `requestImageQuestion`/`uploadImage` helpers.

Add one local state object separate from persisted workflow data:

```ts
const [viralRemakeBatch, setViralRemakeBatch] = useState({
    running: false,
    stageLabel: "",
    completed: 0,
    total: 0,
});
```

Use refs for rotating analysis-stage labels and clear timers on unmount or completion.

**Step 2: Add a video-only upload helper**

Extend `uploadTargetRef` with `videoOnly?: boolean` and add:

```ts
const handleVideoUploadRequest = useCallback((nodeId: string) => {
    uploadTargetRef.current = { nodeId, videoOnly: true };
    if (imageInputRef.current) imageInputRef.current.accept = "video/*";
    imageInputRef.current?.click();
}, []);
```

In `handleImageInputChange`, reject non-video files for `videoOnly` targets with `该素材位只支持视频`. Preserve the existing `imageOnly` behavior.

When replacing the source node, update the workflow to `phase: "idle"` and clear current workflow IDs. Keep old downstream nodes as visible history instead of deleting user content.

When replacing only the product image or changing `replacementBrief`, preserve analysis but reset the active prompt/output IDs and phase to `analyzed` if analysis exists.

**Step 3: Implement `analyzeViralVideo()`**

Guard conditions:

- Current project workflow kind is `viral-video-remake`.
- Source video node has content.
- Text model is configured.
- No other remake stage is running.

Resolve the video Data URI with:

```ts
const videoDataUrl = await mediaToDataUrl({
    url: sourceNode.metadata.content,
    storageKey: sourceNode.metadata.storageKey,
    mimeType: sourceNode.metadata.mimeType || "video/mp4",
});
```

Call `requestImageQuestion()` with one user message containing the text prompt and one `video_url` part. Use an `AbortController` through the existing generation request registry.

**Step 4: Rotate requested status labels without fake completion**

While waiting for the single model response, rotate `viralVideoAnalysisStages` every few seconds. Keep `completed` below `total`. After response parsing succeeds, change the label to `拉片结果整理` and create nodes; only then mark the analysis stage complete.

**Step 5: Create analysis nodes**

Create:

- One summary text node to the right of the source video.
- For each shot, one representative-frame image node and one analysis text node arranged vertically.
- Connections from source video to summary, summary to each shot analysis, and frame to the corresponding shot analysis.

Representative frame time:

```ts
const captureTime = shot.startSeconds + shot.durationSeconds / 2;
```

Use `captureVideoFrame()` then `uploadImage()` for each frame. If frame extraction fails, create only the text node and continue.

Persist `analysisNodeId`, `analysisShotNodeIds`, and `phase: "analyzed"` in the current project workflow. Set the summary node `metadata.prompt` to the complete analysis request.

**Step 6: Handle failure and cancellation**

On model, parsing, or timeline failure:

- Keep the source and product inputs unchanged.
- Create no prompt/video nodes.
- Set workflow phase back to `idle` or keep the last successful `analyzed` state.
- Show the real error string.
- Clear progress timers and request registry entries in `finally`.

**Optional commit checkpoint:**

```bash
git add web/src/pages/canvas/project.tsx
git commit -m "feat: analyze viral videos on canvas"
```

## Task 6: Create editable shot and master prompt nodes

**Files:**

- Modify: `web/src/pages/canvas/project.tsx`
- Modify: `web/src/lib/canvas/viral-video-remake-workflow.ts`

**Step 1: Preserve parsed analysis for later stages**

Store the structured analysis JSON inside the summary node metadata using a new optional metadata field rather than relying on title parsing:

```ts
viralVideoAnalysis?: ViralVideoAnalysis;
viralVideoPromptPlan?: ViralVideoPromptPlan;
```

Add these optional fields to `CanvasNodeMetadata` in `web/src/types/canvas.ts`. Browser-local persistence will then keep the workflow resumable after refresh.

**Step 2: Implement `generateViralVideoPrompts()`**

Guard:

- Workflow has a valid analysis node with `viralVideoAnalysis`.
- Text model is configured.
- Optional product image can be read with `imageToDataUrl()`.
- Current stage is not running.

Determine the video model task limit from the existing video configuration. For the current workflow default to 15 seconds when no smaller explicit setting is available.

Send the planner prompt and optional product `image_url` through `requestImageQuestion()`. Use one request per variant so each variant gets its own originality seed. Limit planner concurrency to 3.

**Step 3: Create prompt nodes**

For each variant create:

- One master prompt node containing originality rules, product continuity, segment plan, complete master prompt, and complete planner request.
- One shot prompt text node for every analyzed shot.
- Connections from corresponding analysis shot nodes to shot prompt nodes.
- Connections from product image to master and shot prompt nodes when uploaded.
- Connections from all shot prompt nodes to the master prompt node.

Use variant and shot numbers in node titles. Store parsed prompt-plan JSON on the master node and the individual actual prompt in each shot node's `metadata.prompt`.

**Step 4: Persist current chain**

Update the workflow with all new prompt node IDs, the first/current master prompt ID, and `phase: "planned"`. If some variant planners fail, keep successful variants and report the failed count; if all fail, remain `analyzed`.

**Optional commit checkpoint:**

```bash
git add web/src/types/canvas.ts web/src/lib/canvas/viral-video-remake-workflow.ts web/src/pages/canvas/project.tsx
git commit -m "feat: generate viral remake shot prompts"
```

## Task 7: Generate complete or segmented videos

**Files:**

- Modify: `web/src/pages/canvas/project.tsx`

**Step 1: Calculate task count before creating nodes**

Collect valid master prompt nodes for the active generation. Sum each plan's segment count. If total is greater than 100, show:

```text
当前设置将生成 N 条视频，请减少变体数量，最多生成 100 条
```

Do not create result nodes when over the limit.

**Step 2: Create output nodes and connections**

For each plan segment create an empty video node:

- Title includes variant number, segment order, and segment title.
- `metadata.prompt` is the exact segment prompt.
- `metadata.seconds` is the closest supported duration setting, never intentionally below the segment duration.
- `metadata.model` is the selected video model.
- Connection comes from the variant master prompt node.
- Optional product image also connects to the output node.

If the plan has one segment, title it as the complete remake video instead of “segment 1”.

**Step 3: Submit at most three concurrent requests**

Reuse the worker-loop pattern from `generateEcommerceVideos()`:

```ts
let cursor = 0;
const worker = async () => {
    while (cursor < tasks.length) {
        const task = tasks[cursor++];
        // requestVideoGeneration, store result, update only this node
    }
};
await Promise.all(Array.from({ length: Math.min(3, tasks.length) }, () => worker()));
```

Call `requestVideoGeneration()` with:

- Segment prompt.
- Optional product image as the only image reference.
- No original source video reference.
- No audio or video reference unless a later product requirement explicitly adds one.

Store successful results through `uploadMediaFile()` and `videoMetadata()` as existing ecommerce generation does.

**Step 4: Keep partial results**

Failures update only their own output node with `status: "error"` and the real `errorDetails`. Completed nodes stay playable. Set workflow back to `planned` after the batch finishes so the user can run another variant batch; keep `outputNodeIds` for the latest batch.

**Step 5: Wire the toolbar into the canvas render**

Derive:

```ts
const viralVideoRemakeWorkflow = currentProject?.workflow?.kind === "viral-video-remake" ? currentProject.workflow : null;
```

Render `ViralVideoRemakeCanvasBar` in the workflow toolbar chain before the generic/null branch. Pass source/product presence, task counts, update callbacks, upload callbacks, and the three stage handlers.

**Optional commit checkpoint:**

```bash
git add web/src/pages/canvas/project.tsx
git commit -m "feat: generate viral remake videos"
```

## Task 8: Update documentation and perform static handoff review

**Files:**

- Modify: `docs/content/docs/progress/pending-test.mdx`
- Modify: `CHANGELOG.md`
- Inspect: `docs/content/docs/progress/todo.mdx`

**Step 1: Record the implemented workflow**

Add one pending-test entry covering:

- Independent `/ecommerce` entry.
- Required video and optional product inputs.
- Actual video-understanding requirement.
- Six analysis dimensions and real timestamps.
- Representative frames and editable prompt nodes.
- Complete/segmented generation behavior.
- 100-task limit and concurrency 3.
- Copyright/originality boundaries.
- Manual checks still required with real text and video models.

Add one concise `[新增]` line to `CHANGELOG.md` `Unreleased`.

Do not move the feature to `features.mdx` until the user confirms it works.

**Step 2: Static-only review**

Run only read-only/static checks permitted by repository instructions:

```powershell
rg -n 'viral-video-remake|爆款复刻' web/src docs/content/docs/progress/pending-test.mdx CHANGELOG.md
rg -n 'buildViralVideoAnalysisPrompt|parseViralVideoAnalysis|buildViralVideoPromptPlannerPrompt|parseViralVideoPromptPlan' web/src/lib/canvas/viral-video-remake-workflow.ts
rg -n 'ViralVideoRemakeCanvasBar|analyzeViralVideo|generateViralVideoPrompts|generateViralRemakeVideos' web/src/pages/canvas/project.tsx web/src/components/canvas/viral-video-remake-canvas-bar.tsx
```

Expected: every workflow symbol appears in its definition and intended call site; no old ecommerce category was renamed or removed.

**Step 3: User-run manual acceptance**

Ask the user to verify in the running app:

1. Open `/ecommerce` and enter “爆款复刻”.
2. Upload a short video and run analysis with a video-capable text model.
3. Compare the detected shot count and timestamps with the actual edit.
4. Inspect all six analysis dimensions and representative frames.
5. Generate prompts with and without a new product image.
6. Confirm original brands/people are not copied into prompts.
7. Generate a video under the model duration limit.
8. Use a longer reference and confirm ordered segmented outputs.
9. Force one upstream failure and confirm other tasks remain successful.
10. Refresh the canvas and confirm analysis/prompt state remains available.

**Optional final commit:**

```bash
git add web/src docs/content/docs/progress/pending-test.mdx CHANGELOG.md
git commit -m "feat: add viral video remake canvas workflow"
```

