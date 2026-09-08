# Semantic Video Beat Analysis Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade viral-video analysis so continuous-take videos are divided by observable semantic action changes instead of being collapsed into one long entry or mechanically split by time.

**Architecture:** Keep the existing `analysis.shots` downstream contract, but enrich every entry as an executable semantic beat with a real-shot parent and continuity state. Add a pure quality evaluator and repair-prompt builder in the canvas workflow library, then let the canvas page perform at most one conditional repair request before creating the analysis node. Preserve the rule that one creative submits exactly one paid full-video task.

**Tech Stack:** TypeScript, React, Node test runner through `tsx`, Vite.

---

### Task 1: Semantic beat data contract and prompt

**Files:**
- Modify: `web/src/lib/canvas/viral-video-remake-workflow.ts`
- Create: `web/tests/viral-video-semantic-analysis.test.mjs`

**Step 1: Write the failing test**

Test that `buildViralVideoAnalysisPrompt(15.09, frameTimes)` contains explicit rules to split by observable semantic changes, forbids fixed-second/even/frame-count splitting, and includes `parentShotIndex`, `boundaryType`, `boundaryReason`, `startState`, `endState`, and `continuityFromPrevious` in the JSON contract.

**Step 2: Run test to verify it fails**

Run: `npx -y tsx --test tests/viral-video-semantic-analysis.test.mjs`

Expected: FAIL because the current prompt and schema do not contain semantic-beat rules or fields.

**Step 3: Write minimal implementation**

Extend `ViralVideoShot`, the schema, text-field parser list, analysis prompt, summary formatter, shot formatter, and prompt-planner timeline with the six semantic fields. The prompt must state that time length is not a segmentation rule and that a continuous take can contain several beats with the same `parentShotIndex`.

**Step 4: Run test to verify it passes**

Run: `npx -y tsx --test tests/viral-video-semantic-analysis.test.mjs`

Expected: PASS.

### Task 2: Semantic-collapse quality gate

**Files:**
- Modify: `web/src/lib/canvas/viral-video-remake-workflow.ts`
- Modify: `web/tests/viral-video-semantic-analysis.test.mjs`

**Step 1: Write the failing tests**

Add tests for `findViralVideoAnalysisQualityIssues`:

- A 15-second single unit is rejected without calculating a fixed target segment count.
- A unit whose action description contains several ordered stages is rejected as collapsed.
- Several continuous beats with the same `parentShotIndex`, valid state handoff, and semantic boundary reasons pass.
- A real cut increments `parentShotIndex` and passes.

**Step 2: Run tests to verify they fail**

Run: `npx -y tsx --test tests/viral-video-semantic-analysis.test.mjs`

Expected: FAIL because the evaluator does not exist.

**Step 3: Write minimal implementation**

Add a pure exported evaluator. It must check semantic fields, parent-shot ordering, and state handoff. It may treat a long single-unit result or a description with multiple ordered action stages as collapsed, but must not derive cut points or a required unit count from seconds.

**Step 4: Run tests to verify they pass**

Run: `npx -y tsx --test tests/viral-video-semantic-analysis.test.mjs`

Expected: PASS.

### Task 3: One conditional repair request

**Files:**
- Modify: `web/src/lib/canvas/viral-video-remake-workflow.ts`
- Modify: `web/src/pages/canvas/project.tsx`
- Modify: `web/tests/viral-video-semantic-analysis.test.mjs`

**Step 1: Write the failing tests**

Test that `buildViralVideoAnalysisRepairPrompt` includes the exact quality issues, the first JSON result, and instructions to preserve evidence while re-segmenting by meaning. Add a source-contract test that the canvas analysis path evaluates the first result and makes at most one repair call before committing.

**Step 2: Run tests to verify they fail**

Run: `npx -y tsx --test tests/viral-video-semantic-analysis.test.mjs`

Expected: FAIL because no repair prompt or conditional repair path exists.

**Step 3: Write minimal implementation**

After the first response parses, evaluate it. If issues exist, set the analysis stage to `正在细化动作节拍`, append a text repair instruction to the same media evidence, request once more, parse and re-evaluate. If the repaired result still has issues, throw an error containing the issues and do not create the analysis node.

**Step 4: Run tests to verify they pass**

Run: `npx -y tsx --test tests/viral-video-semantic-analysis.test.mjs`

Expected: PASS.

### Task 4: Composite-node wording and downstream continuity

**Files:**
- Modify: `web/src/components/canvas/viral-video-analysis-node-content.tsx`
- Modify: `web/src/lib/canvas/viral-video-remake-workflow.ts`
- Modify: `web/tests/viral-video-analysis-node.test.mjs`
- Modify: `web/tests/viral-video-generation.test.mjs`

**Step 1: Write failing tests**

Assert that the composite node displays `镜头/动作节拍`, parent-shot/boundary information, and start/end/continuity state. Assert that the planner prompt carries these fields into every executable beat prompt without changing the single-paid-task generation contract.

**Step 2: Run tests to verify they fail**

Run: `npx -y tsx --test tests/viral-video-analysis-node.test.mjs tests/viral-video-generation.test.mjs`

Expected: FAIL on missing semantic-beat labels and fields.

**Step 3: Write minimal implementation**

Update row formatting and labels. Keep layout, theming, node type, workflow state, and final-generation count unchanged.

**Step 4: Run tests to verify they pass**

Run: `npx -y tsx --test tests/viral-video-analysis-node.test.mjs tests/viral-video-generation.test.mjs`

Expected: PASS.

### Task 5: Documentation and verification

**Files:**
- Modify: `docs/content/docs/progress/pending-test.mdx`

**Step 1: Document the testable change**

Add one pending-test item describing semantic action-beat analysis, one conditional repair, and the fact that generation remains one complete paid task per creative.

**Step 2: Run focused tests**

Run: `npx -y tsx --test tests/viral-video-semantic-analysis.test.mjs tests/viral-video-analysis-node.test.mjs tests/viral-video-generation.test.mjs`

Expected: all pass.

**Step 3: Run the full frontend tests**

Run all `web/tests/*.test.mjs` through `tsx --test`.

Expected: zero failures.

**Step 4: Run typecheck and build**

Run: `npm run typecheck`

Run: `npm run build`

Expected: both exit 0.

**Step 5: Commit**

The current source directory has no Git metadata, so no commit can be created unless the user later initializes or restores the repository metadata.

