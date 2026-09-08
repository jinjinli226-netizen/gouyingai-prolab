# Prompt-First Universal Viral Remake Implementation Plan

> **Superseded:** This replacement-in-place plan is superseded by `2026-09-01-universal-viral-remake-module.md`. The accepted architecture keeps the existing viral-remake workflow untouched and introduces an additive universal module with batch and long-video composition support.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current creative re-planning pipeline with a universal, prompt-first remake pipeline that reconstructs the source video, verifies that reconstruction, substitutes only bound entities, blocks unauthorized semantic drift, and compiles one complete prompt per video candidate.

**Architecture:** Introduce a version-2 canonical reconstruction model whose adaptive timeline units contain source-grounded continuous direction rather than mandatory marketing labels. The source reconstruction is verified against the same video evidence, then passed through deterministic placeholder binding and an immutable-timeline diff gate before model-specific prompt compilation. Existing object recognition, replacement cards, durable batch queue, cost controls, and result library remain in place.

**Tech Stack:** TypeScript 5.8, React 19, Vite 7, Node test runner through `tsx`, existing GouYingAI canvas/Gateway APIs.

---

## Repository safety note

The Git root currently resolves to `C:\Users\25941\Documents\prolab`, while the application under `prolab\` is untracked and the parent repository contains many unrelated deletions. Do not create commits or stage files until that repository boundary is repaired. During this implementation, verify each changed path explicitly and leave changes unstaged. Once the repository is normalized, the task boundaries below can become separate commits.

## Task 1: Add the version-2 canonical reconstruction domain

**Files:**

- Modify: `web/src/lib/canvas/viral-video-domain.ts:1-190`
- Modify: `web/src/types/canvas.ts:172-196`
- Test: `web/tests/viral-video-domain.test.mjs`
- Create: `web/tests/viral-video-reconstruction.test.mjs`

**Step 1: Write failing domain tests**

Add tests that require schema version 2 and validate a reconstruction record without `hook`, `spectacle`, `reveal`, `product_proof`, or `cta` fields.

```js
const reconstruction = {
  schemaVersion: 2,
  id: "reconstruction-1",
  sourceVideoId: "video-1",
  durationSeconds: 8.03,
  aspectRatio: "9:16",
  entities: [
    {
      id: "source-character-1",
      placeholderId: "@角色1",
      kind: "person",
      identityFacts: "原片中可观察到的人物外观",
      behavioralRole: "在整条视频中执行原片动作",
      evidenceIds: ["frame-1"],
      confidence: 0.98,
    },
  ],
  timelineUnits: [
    {
      id: "unit-1",
      startSeconds: 0,
      endSeconds: 8.03,
      parentShotIndex: 1,
      sourceGroundedDirection: "@角色1 在连续镜头中完成原片可观察动作。",
      placeholderIds: ["@角色1"],
      evidenceIds: ["frame-1"],
    },
  ],
  canonicalPrompt: "0.00–8.03 秒：@角色1 在连续镜头中完成原片可观察动作。",
  evidence: [],
  verification: { status: "verified", confidence: 0.95, issues: [], repaired: false },
};

assert.equal(validateViralDomainRecord("reconstruction", reconstruction), reconstruction);
assert.equal("hook" in reconstruction, false);
```

Add a test proving a quiet product showcase with one long continuous movement is valid and does not need a marketing event classification.

**Step 2: Run the tests and verify failure**

Run:

```powershell
pnpm dlx tsx --test tests/viral-video-domain.test.mjs tests/viral-video-reconstruction.test.mjs
```

Expected: FAIL because schema version 2 and the `reconstruction` record kind do not exist.

**Step 3: Implement the minimal domain model**

In `viral-video-domain.ts`:

- Set `VIRAL_VIDEO_DOMAIN_SCHEMA_VERSION` to `2`.
- Add `ViralSourceEntity`, `ViralReconstructionTimelineUnit`, `ViralReconstructionVerification`, `ViralSourceReconstruction`, `ViralPromptPatch`, `ViralPromptDifference`, and `ViralPromptDiffReport`.
- Add `reconstruction` and `diffReport` to `ViralDomainRecordMap` and their validators.
- Keep batch, object fingerprint, binding, candidate, and quality types, updating their schema version only.
- Remove `ViralEventFunction` as a required universal taxonomy. If temporary compatibility is needed inside one file, use an optional free-form `sourceFunction?: string`; do not expose it as a required enum.

Use an open-ended timeline unit:

```ts
export type ViralReconstructionTimelineUnit = {
  id: string;
  startSeconds: number;
  endSeconds: number;
  parentShotIndex: number;
  sourceGroundedDirection: string;
  placeholderIds: string[];
  evidenceIds: string[];
};
```

In `canvas.ts`, persist `viralVideoSourceReconstruction`, `viralVideoPromptPatches`, and `viralVideoPromptDiffReport` on node metadata. Keep legacy fields temporarily only where needed to compile the transition.

**Step 4: Run tests and typecheck**

Run:

```powershell
pnpm dlx tsx --test tests/viral-video-domain.test.mjs tests/viral-video-reconstruction.test.mjs
pnpm exec tsc --noEmit
```

Expected: PASS.

## Task 2: Replace fixed marketing analysis with source reconstruction

**Files:**

- Modify: `web/src/lib/canvas/viral-video-remake-workflow.ts:25-242`
- Modify: `web/src/lib/canvas/viral-video-analysis-node.ts`
- Modify: `web/tests/viral-video-semantic-analysis.test.mjs`
- Modify: `web/tests/viral-video-source-recognition.test.mjs`
- Modify: `web/tests/viral-video-analysis-node.test.mjs`
- Test: `web/tests/viral-video-reconstruction.test.mjs`

**Step 1: Write failing prompt and parser tests**

Require the reconstruction prompt to:

- Describe adaptive time units and a canonical director prompt.
- Create stable placeholders before replacement assets are known.
- Explicitly forbid fixed-second splitting and mandatory narrative labels.
- Explicitly forbid inventing behavior for future product substitution.
- Cover time from 0 to the true source duration.

```js
const prompt = buildViralVideoSourceReconstructionPrompt(8.03, [0, 0.4, 1.2, 4.8, 8.0]);
assert.match(prompt, /canonicalPrompt/);
assert.match(prompt, /sourceGroundedDirection/);
assert.match(prompt, /稳定占位符/);
assert.match(prompt, /不得要求.*冲突.*反转.*CTA/s);
assert.match(prompt, /不得按固定秒数/);
```

Add parser tests for a talking-head video, a quiet product showcase, an ASMR process, and a one-take physical action. None may require a `hook` or `cta` field.

**Step 2: Run focused tests and verify failure**

Run:

```powershell
pnpm dlx tsx --test tests/viral-video-reconstruction.test.mjs tests/viral-video-semantic-analysis.test.mjs tests/viral-video-source-recognition.test.mjs
```

Expected: FAIL because source reconstruction builders and parsers are missing.

**Step 3: Implement source reconstruction builders and parser**

In `viral-video-remake-workflow.ts`:

- Replace `buildViralVideoAnalysisPrompt` internals with `buildViralVideoSourceReconstructionPrompt` and retain a temporary export alias only if an untouched caller still needs it.
- Replace rigid `ViralVideoShot` fields with `ViralReconstructionTimelineUnit` as the canonical downstream representation.
- Parse objects into source entities with stable placeholders.
- Build `canonicalPrompt` from the returned adaptive timeline.
- Keep representative evidence frame extraction and object recognition integration.
- Reject gaps, overlaps, reverse ordering, missing first/last coverage, empty direction text, unknown placeholders, and a single unit that collapses multiple ordered actions.
- Do not validate the presence of a hook, reveal, CTA, narrative purpose, pose, orientation, lighting, or shot-size field.

The canonical prompt must be assembled in source order:

```ts
const canonicalPrompt = units
  .map((unit) => `${formatSeconds(unit.startSeconds)}–${formatSeconds(unit.endSeconds)}：${unit.sourceGroundedDirection}`)
  .join("\n");
```

**Step 4: Update analysis-node persistence and compatibility**

Persist the reconstruction object and representative frames in the same composite analysis node. Stop writing a second, independent creative plan into analysis metadata.

**Step 5: Run focused tests and typecheck**

Run:

```powershell
pnpm dlx tsx --test tests/viral-video-reconstruction.test.mjs tests/viral-video-semantic-analysis.test.mjs tests/viral-video-source-recognition.test.mjs tests/viral-video-analysis-node.test.mjs
pnpm exec tsc --noEmit
```

Expected: PASS.

## Task 3: Add a second-pass reconstruction verifier

**Files:**

- Modify: `web/src/lib/canvas/viral-video-remake-workflow.ts:192-242`
- Modify: `web/src/pages/canvas/project.tsx:2677-2897`
- Modify: `web/src/lib/canvas/viral-video-state-machine.ts`
- Test: `web/tests/viral-video-reconstruction.test.mjs`
- Modify: `web/tests/viral-video-state-machine.test.mjs`
- Modify: `web/tests/viral-video-semantic-analysis.test.mjs`

**Step 1: Write failing verifier tests**

Add tests for `buildViralVideoReconstructionVerificationPrompt`, `parseViralVideoReconstructionVerification`, and `applyVerifiedViralVideoReconstruction`.

The verifier prompt must receive the first reconstruction and the same media evidence, then check omissions, inventions, action actor/receiver changes, state changes, order, timing, cuts, camera movement, text, and audio.

```js
assert.match(prompt, /遗漏/);
assert.match(prompt, /凭空添加/);
assert.match(prompt, /动作主体/);
assert.match(prompt, /受力|状态变化/);
assert.match(prompt, /同一份原片证据/);
```

Add an integration-source test proving the canvas calls the verifier once after reconstruction and blocks generation if verification still fails.

**Step 2: Run focused tests and verify failure**

Run:

```powershell
pnpm dlx tsx --test tests/viral-video-reconstruction.test.mjs tests/viral-video-semantic-analysis.test.mjs tests/viral-video-state-machine.test.mjs
```

Expected: FAIL because verification stages do not exist.

**Step 3: Implement verifier parsing and repair**

The second model response must contain:

```ts
type ViralReconstructionVerificationResult = {
  verdict: "verified" | "repaired" | "rejected";
  confidence: number;
  issues: string[];
  repairedTimelineUnits: ViralReconstructionTimelineUnit[];
  repairedCanonicalPrompt: string;
};
```

Accept `verified` directly. Accept `repaired` only after running the local structural quality gate on the repaired units. Reject `rejected`, low confidence, unresolved issues, or invalid repaired coverage.

**Step 4: Wire the verifier into the canvas analysis flow**

In `project.tsx`:

- Reuse the same complete-video input or temporal evidence bundle for the verifier.
- Run verification after source reconstruction and before committing the composite node as ready.
- Remove the current repair that only reacts to missing fields as the main fidelity check; retain local structural validation before and after verification.
- Never create a paid video task from an unverified reconstruction.

Update the state machine to include `reconstructing`, `verifying`, `binding_ready`, `diff_checking`, and `ready_to_submit` phases, with source changes invalidating all downstream revisions and upload changes preserving reconstruction/verification revisions.

**Step 5: Run tests and typecheck**

Run:

```powershell
pnpm dlx tsx --test tests/viral-video-reconstruction.test.mjs tests/viral-video-semantic-analysis.test.mjs tests/viral-video-state-machine.test.mjs
pnpm exec tsc --noEmit
```

Expected: PASS.

## Task 4: Implement deterministic placeholder substitution and semantic diff gating

**Files:**

- Create: `web/src/lib/canvas/viral-video-prompt-compiler.ts`
- Create: `web/tests/viral-video-prompt-compiler.test.mjs`
- Modify: `web/src/lib/canvas/viral-video-object-binding.ts`
- Modify: `web/tests/viral-video-object-binding.test.mjs`

**Step 1: Write failing compiler tests**

Cover these cases:

1. Replacing `@商品1` changes only its identity description.
2. Multiple placeholders map to distinct uploaded assets in stable order.
3. An unresolved ambiguous binding blocks compilation.
4. A direct action edit without a user patch fails the diff gate.
5. A user-authorized local patch is allowed only for its declared timeline units.
6. The regression pair “挤出/坠落/撞入” versus “拿起/安装” is rejected.

```js
const report = compareViralPromptSemantics(source, unauthorizedRewrite, []);
assert.equal(report.passed, false);
assert.match(report.forbiddenChanges[0].summary, /挤出.*安装|动作语义/);
```

**Step 2: Run tests and verify failure**

Run:

```powershell
pnpm dlx tsx --test tests/viral-video-prompt-compiler.test.mjs tests/viral-video-object-binding.test.mjs
```

Expected: FAIL because the compiler and diff gate do not exist.

**Step 3: Implement deterministic binding**

Add pure functions:

```ts
compileViralBoundPrompt(reconstruction, entities, bindings, patches)
compareViralPromptSemantics(reconstruction, compiled, patches)
assertViralPromptDiffPassed(report)
```

Rules:

- Never send the full reconstruction to another “creative planner”.
- Render replacement identity facts through a stable placeholder manifest.
- Keep each timeline unit's `sourceGroundedDirection`, time range, order, and parent shot unchanged unless an explicit patch targets that unit.
- Validate patches by unit ID and preserve untouched units byte-for-byte after placeholder masking.
- Treat actor, receiver, action, physical state, camera, visible text, and audio changes outside authorized patches as forbidden.
- Keep a machine-readable diff report on the template node.

**Step 4: Integrate existing object binding**

Convert current source-object/replacement-object bindings into `PromptEntityBinding`. A direct upload under an object card remains `user-confirmed`; single unambiguous objects can remain `auto-bound`; ambiguous bindings must stay blocked.

**Step 5: Run tests and typecheck**

Run:

```powershell
pnpm dlx tsx --test tests/viral-video-prompt-compiler.test.mjs tests/viral-video-object-binding.test.mjs
pnpm exec tsc --noEmit
```

Expected: PASS.

## Task 5: Remove the creative planner from template and generation compilation

**Files:**

- Modify: `web/src/lib/canvas/viral-video-template.ts:14-141`
- Modify: `web/src/lib/canvas/viral-video-generation.ts:1-118`
- Modify: `web/src/lib/canvas/viral-video-batch-compiler.ts:11-70`
- Modify: `web/tests/viral-video-template.test.mjs`
- Modify: `web/tests/viral-video-generation.test.mjs`
- Modify: `web/tests/viral-video-batch-compiler.test.mjs`

**Step 1: Write failing regression tests**

Require the template to take a verified reconstruction and diff report, not `ViralVideoPromptPlan`. Require the final generation prompt to preserve every timeline unit in order and include the stable reference-image manifest.

```js
assert.equal(template.reconstructionId, reconstruction.id);
assert.equal(template.diffReport.passed, true);
assert.equal(template.canonicalPrompt, compiled.canonicalPrompt);
assert.doesNotMatch(finalPrompt, /重新发明|原创重制导演|差异化创意种子/);
```

Add a batch test proving 100 candidates share the same canonical timeline and bindings, and only declared variable slots or seeds differ.

**Step 2: Run focused tests and verify failure**

Run:

```powershell
pnpm dlx tsx --test tests/viral-video-template.test.mjs tests/viral-video-generation.test.mjs tests/viral-video-batch-compiler.test.mjs
```

Expected: FAIL because the current template trusts planner-generated shot prompts.

**Step 3: Rebuild the template from verified canonical data**

In `viral-video-template.ts`:

- Replace ID-count coverage as the fidelity gate with the passed semantic diff report.
- Build one template from the reconstruction, bindings, compiled canonical prompt, patches, and diff report.
- Remove required `hookMechanism` and `narrativeStructure` fields.
- Do not use a planned shot prompt in place of source-grounded direction.

**Step 4: Rebuild final prompt compilation**

In `viral-video-generation.ts`:

- Compile the verified canonical prompt into target-model syntax.
- Preserve exact timeline order and user-approved duration.
- Add the replacement manifest and reference image order.
- Add negative constraints derived from detected unauthorized alternatives, not from a fixed phone-case example.
- Stop before submission when the target model cannot support the requested duration, aspect ratio, reference count, or audio behavior.

**Step 5: Lock batch compilation**

In `viral-video-batch-compiler.ts`, use the template's canonical prompt as immutable input. Variable slots may alter only declared identity/style fragments; they cannot regenerate timeline units.

**Step 6: Run tests and typecheck**

Run:

```powershell
pnpm dlx tsx --test tests/viral-video-template.test.mjs tests/viral-video-generation.test.mjs tests/viral-video-batch-compiler.test.mjs
pnpm exec tsc --noEmit
```

Expected: PASS.

## Task 6: Wire the universal pipeline into the canvas workflow

**Files:**

- Modify: `web/src/pages/canvas/project.tsx:2677-3290,4920-5285,6040-6150`
- Modify: `web/src/lib/canvas/viral-video-remake-workflow.ts:521-616`
- Modify: `web/src/components/canvas/viral-video-remake-canvas-bar.tsx`
- Modify: `web/tests/viral-video-native-workflow.test.mjs`
- Modify: `web/tests/viral-remake-ui-contract.test.mjs`

**Step 1: Write failing workflow integration tests**

Require the project source to follow this order:

```text
reconstruct -> verify -> bind -> compile -> diff check -> submit
```

The tests must prove:

- `generateViralVideoPrompts` no longer calls `buildViralVideoPromptPlannerPrompt`.
- A failed diff report prevents `createViralBatch` or video-task submission.
- Changing uploaded assets preserves the verified reconstruction but invalidates the compiled prompt and diff report.
- Changing candidate count does not rerun reconstruction.
- One candidate creates one complete video task regardless of timeline-unit count.

**Step 2: Run focused tests and verify failure**

Run:

```powershell
pnpm dlx tsx --test tests/viral-video-native-workflow.test.mjs tests/viral-remake-ui-contract.test.mjs tests/viral-video-state-machine.test.mjs
```

Expected: FAIL because the current workflow still has plan-and-generate behavior.

**Step 3: Replace planning with compilation**

In `project.tsx`:

- Rename the planning action internally to compile/verify.
- Read only the verified reconstruction from the analysis node.
- Build bindings and optional patches.
- Compile deterministically and run the diff gate.
- Store one verified template node.
- Submit only when verification and diff status are both passed.
- Keep existing durable batch and result-node calls.

Remove `viralAutoGenerateAfterPlanningRef` if it can bypass preflight. Automatic continuation may happen only after the diff gate passes and must still consume the user's original one-click authorization exactly once.

**Step 4: Update primary action and invalidation logic**

Map the canvas button to `开始识别与重建`, `正在校验原片`, `生成复刻视频`, and running progress. Replacing an asset must not rerun video understanding. Replacing the source must invalidate every downstream artifact.

**Step 5: Run tests and typecheck**

Run:

```powershell
pnpm dlx tsx --test tests/viral-video-native-workflow.test.mjs tests/viral-remake-ui-contract.test.mjs tests/viral-video-state-machine.test.mjs
pnpm exec tsc --noEmit
```

Expected: PASS.

## Task 7: Update the five-card UI without adding a specialized mode

**Files:**

- Modify: `web/src/components/canvas/viral-video-requirements-node-content.tsx`
- Modify: `web/src/components/canvas/viral-video-analysis-node-content.tsx`
- Modify: `web/src/components/canvas/viral-video-template-node-content.tsx`
- Modify: `web/src/components/canvas/viral-video-replacement-library-node-content.tsx`
- Modify: `web/tests/viral-video-analysis-node.test.mjs`
- Modify: `web/tests/viral-remake-ui-contract.test.mjs`

**Step 1: Write failing UI contract tests**

Require these labels and states:

- `额外改动（可选）`
- `已验证原片重建`
- `保留什么`
- `替换什么`
- `额外改变什么`
- `语义差异检查通过` or a precise blocked reason

Also require the absence of user-facing modes or example-specific language:

```js
for (const forbidden of ["蜘蛛侠", "手机壳", "撅屁股", "牛排", "冲突模式", "揭晓模式"]) {
  assert.doesNotMatch(allUiSource, new RegExp(forbidden));
}
```

**Step 2: Run UI tests and verify failure**

Run:

```powershell
pnpm dlx tsx --test tests/viral-video-analysis-node.test.mjs tests/viral-remake-ui-contract.test.mjs
```

Expected: FAIL because the current cards still describe planning-oriented output.

**Step 3: Implement compact universal summaries**

- Rename the textarea to `额外改动（可选）`; keep it empty by default.
- Show adaptive timeline units with representative images and continuous direction, not six mandatory static columns.
- Show verification confidence and issues.
- Show a concise preflight summary: preserved content, bound replacements, explicit patches.
- Keep full canonical prompt and diff report expandable.
- Keep the five-card layout, dragging behavior, scrolling isolation, batch card, and result library unchanged.

**Step 4: Run UI tests and typecheck**

Run:

```powershell
pnpm dlx tsx --test tests/viral-video-analysis-node.test.mjs tests/viral-remake-ui-contract.test.mjs
pnpm exec tsc --noEmit
```

Expected: PASS.

## Task 8: Run the full regression suite and production build

**Files:**

- Modify only files required by failures proven to be caused by the version-2 remake model.
- Do not modify unrelated canvas, commerce, or provider behavior.

**Step 1: Run all viral-remake tests**

Run:

```powershell
$tests = (Get-ChildItem -LiteralPath tests -Filter 'viral-video-*.test.mjs').FullName
$tests += (Resolve-Path 'tests/viral-remake-ui-contract.test.mjs').Path
pnpm dlx tsx --test $tests
```

Expected: all tests PASS.

**Step 2: Run static verification**

Run:

```powershell
pnpm exec tsc --noEmit
pnpm exec vite build
pnpm exec prettier --check src/lib/canvas/viral-video-*.ts src/components/canvas/viral-video-*.tsx src/pages/canvas/project.tsx tests/viral-video-*.test.mjs tests/viral-remake-ui-contract.test.mjs
```

Expected: typecheck and build PASS; formatted files report no differences.

**Step 3: Inspect the final diff without staging**

Run:

```powershell
git -C 'C:\Users\25941\Documents\prolab' status --short -- 'prolab/web' 'prolab/docs'
git -C 'C:\Users\25941\Documents\prolab' diff --no-index -- NUL 'prolab/docs/plans/2026-09-01-prompt-first-universal-viral-remake.md'
```

Expected: only intended project files are listed. Do not run `git add` while the application remains an untracked subtree.

**Step 4: Manual acceptance in the local canvas**

Use at least six source types: quiet showcase, talking head, ASMR, one-take physical action, multi-cut montage, and clothing try-on.

For each source:

1. Upload only the source video and verify reconstruction can complete.
2. Confirm no absent marketing label is required.
3. Add zero, one, and multiple replacement objects.
4. Confirm the source timeline remains unchanged when only bindings change.
5. Attempt one unauthorized action rewrite and verify submission is blocked.
6. Add one explicit local patch and verify only the declared units change.
7. Generate one complete video and confirm timeline units did not become separate paid tasks.

The known physical-action regression must specifically verify that an expel/fall/impact chain cannot silently become a pick-up/install chain.
