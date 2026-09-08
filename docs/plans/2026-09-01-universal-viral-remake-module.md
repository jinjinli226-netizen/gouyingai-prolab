# Universal Viral Remake Module Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an isolated universal viral-remake Beta that preserves source-video behavior, supports 1–1000 complete candidates, and splits/composes videos longer than the selected model limit without changing the existing viral-remake workflow.

**Architecture:** Build a pure TypeScript core under `web/src/lib/universal-viral-remake` and expose it through one engine facade. Add an isolated Gateway runtime for persistent candidate/segment execution and FFmpeg composition; connect it to the canvas through a thin Beta adapter and separate entry. Existing viral-remake modules, routes, nodes, tests, and historical state remain untouched.

**Tech Stack:** TypeScript 5.8, React 19, Vite 7, Express 5, existing canvas job/artifact repositories, FFmpeg/FFprobe, Node test runner through `tsx`.

---

## Safety and execution rules

- Follow `@test-driven-development`: every production function starts with a failing test.
- Use `@systematic-debugging` for unexpected failures and `@verification-before-completion` before delivery.
- The application is currently an untracked subtree of a dirty parent Git repository. Do not stage or commit files until the repository boundary is repaired.
- Do not import or modify existing `web/src/lib/canvas/viral-video-*` implementation files in Tasks 1–6.
- Do not create example-specific rules for phone cases, robots, food, conflict, reveals, CTAs, poses, or narrative genres.

## Task 1: Create the isolated domain and semantic segmenter

**Files:**

- Create: `web/src/lib/universal-viral-remake/types.ts`
- Create: `web/src/lib/universal-viral-remake/segmentation.ts`
- Create: `web/src/lib/universal-viral-remake/index.ts`
- Create: `web/tests/universal-viral-remake-segmentation.test.mjs`

**Step 1: Write failing tests**

Cover:

- 8-second input becomes one generation segment.
- 31-second input with semantic boundaries becomes three segments, each `<= 15` seconds.
- A boundary is selected by source order and preference, not uniform division.
- A timeline unit longer than the model limit uses declared safe continuation points.
- A long unit without a safe point returns `needs-refinement` rather than hard-cutting.
- Segment continuity contracts carry entity, object, camera, and audio state.

```js
const result = planUniversalRemakeSegments(reconstruction, { maxDurationSeconds: 15 });
assert.equal(result.status, "ready");
assert.deepEqual(result.segments.map((segment) => [segment.sourceStartSeconds, segment.sourceEndSeconds]), [
  [0, 12], [12, 24], [24, 31],
]);
assert.ok(result.segments.every((segment) => segment.durationSeconds <= 15));
```

**Step 2: Run and verify RED**

```powershell
pnpm dlx tsx --test tests/universal-viral-remake-segmentation.test.mjs
```

Expected: FAIL because the module does not exist.

**Step 3: Implement minimal types and segmenter**

Define:

```ts
type UniversalTimelineUnit = {
  id: string;
  sourceStartSeconds: number;
  sourceEndSeconds: number;
  parentShotIndex: number;
  direction: string;
  placeholderIds: string[];
  evidenceIds: string[];
  boundaryAfter: "hard-cut" | "transition" | "semantic" | "continuous" | "none";
  safeContinuationPointsSeconds: number[];
  startContinuity: UniversalContinuityState;
  endContinuity: UniversalContinuityState;
};
```

Implement a forward greedy packer that prefers the latest allowed boundary not exceeding the model limit. Split inside one unit only at an explicit safe continuation point. Return a structured issue when no valid plan exists.

**Step 4: Run and verify GREEN**

```powershell
pnpm dlx tsx --test tests/universal-viral-remake-segmentation.test.mjs
pnpm exec tsc --noEmit
```

Expected: PASS.

## Task 2: Add deterministic entity binding and fidelity gating

**Files:**

- Create: `web/src/lib/universal-viral-remake/binding.ts`
- Create: `web/src/lib/universal-viral-remake/fidelity.ts`
- Modify: `web/src/lib/universal-viral-remake/index.ts`
- Create: `web/tests/universal-viral-remake-fidelity.test.mjs`

**Step 1: Write failing tests**

Cover:

- Zero replacement assets is valid.
- One unambiguous replacement can auto-bind.
- Ambiguous replacements block compilation.
- Bound entity identity changes while timeline direction remains unchanged after placeholder masking.
- Unauthorized action, actor, receiver, timing, camera, visible-text, or audio changes fail.
- An explicit patch can change only its declared timeline units.

```js
const report = compareUniversalRemakeFidelity({
  source: sourceTemplate,
  candidate: candidateWithDifferentAction,
  patches: [],
});
assert.equal(report.passed, false);
assert.equal(report.forbiddenChanges[0].kind, "timeline-direction");
```

**Step 2: Run and verify RED**

```powershell
pnpm dlx tsx --test tests/universal-viral-remake-fidelity.test.mjs
```

Expected: FAIL because binding and fidelity functions do not exist.

**Step 3: Implement minimal binding and diff**

- Use stable placeholder IDs generated during reconstruction.
- Store identity facts separately from behavioral direction.
- Render replacement identity manifests deterministically.
- Preserve untouched timeline units byte-for-byte after placeholder masking.
- Validate patch unit IDs and before/after content.
- Return `allowedChanges`, `forbiddenChanges`, and `passed`.

Do not call an AI planner in this layer.

**Step 4: Run and verify GREEN**

```powershell
pnpm dlx tsx --test tests/universal-viral-remake-fidelity.test.mjs
pnpm exec tsc --noEmit
```

Expected: PASS.

## Task 3: Compile prompts, batch candidates, and long-video execution manifests

**Files:**

- Create: `web/src/lib/universal-viral-remake/prompt-compiler.ts`
- Create: `web/src/lib/universal-viral-remake/batch-compiler.ts`
- Modify: `web/src/lib/universal-viral-remake/index.ts`
- Create: `web/tests/universal-viral-remake-compiler.test.mjs`

**Step 1: Write failing tests**

Cover:

- One short candidate contains one segment request and one logical result.
- One 31-second candidate contains multiple ordered segment requests and one composition manifest.
- Candidate count defaults to 1 and clamps to 1–1000.
- One template is reused by all candidates.
- Fixed bindings remain identical across all segments and candidates.
- Only declared variable slots differ.
- Cost input includes total generated seconds across every segment and candidate.
- The prompt compiler includes each segment's continuity-in/out contract without re-planning actions.

```js
const manifests = compileUniversalRemakeCandidates(template, { count: 100, seed: 7, variableSlots: [] }, capabilities);
assert.equal(manifests.length, 100);
assert.ok(manifests.every((candidate) => candidate.templateId === template.id));
assert.ok(manifests.every((candidate) => candidate.segments.length === 3));
assert.ok(manifests.every((candidate) => candidate.output.kind === "composed-video"));
```

**Step 2: Run and verify RED**

```powershell
pnpm dlx tsx --test tests/universal-viral-remake-compiler.test.mjs
```

Expected: FAIL because compilers do not exist.

**Step 3: Implement prompt and candidate compilers**

- Compile one prompt per generation segment.
- Include canonical source direction, bindings, continuity contract, duration, aspect ratio, language/audio facts, and generic negative constraints.
- Create a stable candidate ID and segment IDs.
- Create a composition manifest with ordered segment IDs, original boundary kinds, target duration, aspect ratio, and audio policy.
- Keep manifests serializable and provider-neutral.
- Use bounded synchronous loops; do not create 1000 concurrent promises.

**Step 4: Run and verify GREEN**

```powershell
pnpm dlx tsx --test tests/universal-viral-remake-compiler.test.mjs
pnpm exec tsc --noEmit
```

Expected: PASS.

## Task 4: Add reconstruction, verification, and the engine facade

**Files:**

- Create: `web/src/lib/universal-viral-remake/reconstruction.ts`
- Create: `web/src/lib/universal-viral-remake/verification.ts`
- Create: `web/src/lib/universal-viral-remake/engine.ts`
- Modify: `web/src/lib/universal-viral-remake/index.ts`
- Create: `web/tests/universal-viral-remake-engine.test.mjs`

**Step 1: Write failing tests**

Require the reconstruction prompt to use adaptive timeline units, stable placeholders, source evidence, safe continuation points, and an open-ended director description. It must forbid mandatory marketing labels and fixed-second splitting.

Require the verification prompt to compare the first reconstruction with the same video evidence and return `verified`, `repaired`, or `rejected`.

Require the engine to enforce:

```text
reconstruct -> verify -> bind -> segment -> compile -> fidelity gate -> ready
```

**Step 2: Run and verify RED**

```powershell
pnpm dlx tsx --test tests/universal-viral-remake-engine.test.mjs
```

Expected: FAIL because the engine does not exist.

**Step 3: Implement prompts, parsers, and facade**

- Keep AI calls behind `understandVideo`.
- Validate full time coverage, source order, stable placeholders, boundary safety, and evidence links locally.
- Verify once; reject unresolved low-confidence results.
- Expose one public `createUniversalViralRemakeEngine` facade.
- Export public types and facade functions only from `index.ts`.

**Step 4: Run and verify GREEN**

```powershell
pnpm dlx tsx --test tests/universal-viral-remake-engine.test.mjs
pnpm exec tsc --noEmit
```

Expected: PASS.

## Task 5: Add safe Gateway FFmpeg composition

**Files:**

- Create: `gateway/src/universal-viral-remake/types.ts`
- Create: `gateway/src/universal-viral-remake/compositor.ts`
- Create: `gateway/tests/universal-remake-compositor.test.mjs`
- Modify: `gateway/src/types.ts` only to register the additive composition job kind.

**Step 1: Write failing unit tests**

Cover:

- Reject non-owned or external segment URLs.
- Build FFmpeg arguments as an array without shell concatenation.
- Use direct concat for source hard cuts.
- Use bounded 80–160ms transitions only for declared continuous boundaries.
- Normalize resolution, FPS, H.264/AAC, and sample rate.
- Preserve requested total duration within 0.1 seconds.
- Return a typed `ffmpeg-unavailable` error.

**Step 2: Run and verify RED**

```powershell
pnpm --dir gateway exec tsx --test tests/universal-remake-compositor.test.mjs
```

Expected: FAIL because the compositor does not exist.

**Step 3: Implement composition**

- Use `spawn`/`execFile`, never `shell: true`.
- Resolve only owned canvas artifact paths.
- Probe every input with FFprobe.
- Save final MP4 through the existing canvas artifact store.
- Keep source clips when composition fails.
- Include process timeout and temporary-directory cleanup.

**Step 4: Run and verify GREEN**

```powershell
pnpm --dir gateway exec tsx --test tests/universal-remake-compositor.test.mjs
pnpm --dir gateway run build
```

Expected: PASS.

## Task 6: Add persistent run, candidate, segment, and composition orchestration

**Files:**

- Create: `gateway/src/universal-viral-remake/repository.ts`
- Create: `gateway/src/universal-viral-remake/coordinator.ts`
- Create: `gateway/src/universal-viral-remake/routes.ts`
- Create: `gateway/src/universal-viral-remake/index.ts`
- Create: `gateway/tests/universal-remake-repository.test.mjs`
- Create: `gateway/tests/universal-remake-coordinator.test.mjs`
- Create: `gateway/tests/universal-remake-routes.test.mjs`
- Modify: `gateway/src/server.ts` and `gateway/src/local-server.ts` only to register the new router/coordinator.

**Step 1: Write failing tests**

Cover:

- Idempotent run creation.
- Candidate count 1–1000.
- Candidate-level bounded concurrency.
- Sequential segment generation inside one candidate when continuity is required.
- Short video goes through one segment without a separate visible result.
- Composition starts only after all candidate segments succeed.
- Composition-only retry does not regenerate paid segments.
- Pause, resume, cancel, refresh recovery, and failed-candidate retry.
- One completed candidate exposes one final artifact.

**Step 2: Run and verify RED**

```powershell
pnpm --dir gateway exec tsx --test tests/universal-remake-repository.test.mjs tests/universal-remake-coordinator.test.mjs tests/universal-remake-routes.test.mjs
```

Expected: FAIL because runtime components do not exist.

**Step 3: Implement repository, coordinator, and routes**

- Follow existing local/supabase repository patterns without importing old viral-batch coordinator internals.
- Reuse `CanvasJobRepository` for individual video segment jobs.
- Store parent run/candidate/segment/composition status separately.
- Enforce ownership and canvas ID on every route.
- Materialize only a bounded window of candidates and one continuity-dependent segment per candidate.

**Step 4: Run and verify GREEN**

```powershell
pnpm --dir gateway exec tsx --test tests/universal-remake-repository.test.mjs tests/universal-remake-coordinator.test.mjs tests/universal-remake-routes.test.mjs
pnpm --dir gateway run build
```

Expected: PASS.

## Task 7: Add the separate canvas Beta adapter and five-card UI

**Files:**

- Create: `web/src/lib/universal-viral-remake/canvas-adapter.ts`
- Create: `web/src/components/canvas/universal-remake-canvas-bar.tsx`
- Create: `web/src/components/canvas/universal-remake-analysis-content.tsx`
- Create: `web/src/components/canvas/universal-remake-bindings-content.tsx`
- Create: `web/src/components/canvas/universal-remake-template-content.tsx`
- Create: `web/src/components/canvas/universal-remake-run-content.tsx`
- Create: `web/src/components/canvas/universal-remake-results-content.tsx`
- Create: `web/tests/universal-remake-ui-contract.test.mjs`
- Modify: `web/src/components/canvas/canvas-toolbar.tsx` only to add `通用复刻 Beta`.
- Modify: `web/src/pages/canvas/project.tsx` only at explicit registration/render/action adapter points.
- Modify: `web/src/types/canvas.ts` only to add isolated workflow/node metadata.

**Step 1: Write failing UI and source-isolation tests**

Require:

- Old `爆款复刻` button and old workflow source remain present.
- New `通用复刻 Beta` button creates a distinct workflow kind.
- New module source never imports `viral-video-remake-workflow.ts`.
- Five cards show reference, bindings, verified template, batch/long-video plan, and complete results.
- Long-video plan displays source duration, segment count, boundaries, provider calls, and estimated cost.
- Candidate count defaults to 1 and supports 1000.
- No example-specific or mandatory narrative wording appears.

**Step 2: Run and verify RED**

```powershell
pnpm dlx tsx --test tests/universal-remake-ui-contract.test.mjs
```

Expected: FAIL because the Beta UI does not exist.

**Step 3: Implement the thin adapter and UI**

- Reuse existing video upload, model selection, artifact upload, cost display, and result player through props/ports.
- Do not copy the old workflow implementation.
- Use one main action driven by the new engine state.
- Submit Gateway runs only after verification and fidelity gates pass.
- Keep detailed canonical prompts and diff reports expandable.

**Step 4: Run and verify GREEN**

```powershell
pnpm dlx tsx --test tests/universal-remake-ui-contract.test.mjs
pnpm exec tsc --noEmit
pnpm exec vite build
```

Expected: PASS.

## Task 8: Full compatibility, integration, and media verification

**Files:**

- Modify only files proven by failing tests to require additive registration.
- Do not rewrite existing viral-remake implementation files.

**Step 1: Run old and new Web tests**

```powershell
$old = (Get-ChildItem -LiteralPath web/tests -Filter 'viral-video-*.test.mjs').FullName
$old += (Resolve-Path 'web/tests/viral-remake-ui-contract.test.mjs').Path
$new = (Get-ChildItem -LiteralPath web/tests -Filter 'universal-viral-remake-*.test.mjs').FullName
$new += (Get-ChildItem -LiteralPath web/tests -Filter 'universal-remake-*.test.mjs').FullName
pnpm --dir web dlx tsx --test $old $new
```

Expected: all old and new tests PASS.

**Step 2: Run Gateway tests**

```powershell
pnpm --dir gateway test
```

Expected: all tests PASS.

**Step 3: Run builds and formatting checks**

```powershell
pnpm --dir web exec tsc --noEmit
pnpm --dir web exec vite build
pnpm --dir gateway run build
pnpm --dir web exec prettier --check src/lib/universal-viral-remake src/components/canvas/universal-remake-*.tsx tests/universal-*.test.mjs
```

Expected: PASS with no warnings caused by the new module.

**Step 4: Run real FFmpeg fixture integration**

Generate or use owned local fixtures for 8 seconds and 31 seconds. Verify:

- 8 seconds produces one segment and one final result.
- 31 seconds produces semantic segments no longer than 15 seconds.
- All segment resolutions/FPS/audio formats normalize.
- The final duration differs from the requested duration by no more than 0.1 seconds.
- Composition-only retry does not recreate segment outputs.

**Step 5: Manual canvas acceptance**

Test quiet showcase, talking head, ASMR, one-take physical action, multi-cut montage, and clothing try-on. Test 1, multiple, and 1000 manifest compilation without automatically submitting paid work. Confirm the old viral-remake workflow still opens and behaves as before.

