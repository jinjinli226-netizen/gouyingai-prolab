# Native Viral Video Remake Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an executable viral-video-remake entry and one-click generation flow directly to the GouYingAI infinite canvas.

**Architecture:** Reuse the existing viral analysis, prompt planning, and Gateway video submission pipeline. Add a toolbar entry that activates the workflow around the selected video, generalize the optional reference image from product-only to replacement-element input, and use a one-shot state flag to continue from successful planning into the existing single-video submission path.

**Tech Stack:** React 19, TypeScript, Zustand, Ant Design, Node test runner, Vite.

---

### Task 1: Define activation and primary-action contracts

**Files:**
- Modify: `web/src/lib/canvas/viral-video-remake-workflow.ts`
- Test: `web/tests/viral-video-native-workflow.test.mjs`

**Step 1: Write the failing tests**

Cover activation from a selected video, one replacement placeholder only, rejection when no usable source exists, and primary actions for `idle`, `analyzed`, and `planned`.

**Step 2: Run the test to verify it fails**

Run: `node --test tests/viral-video-native-workflow.test.mjs`

Expected: FAIL because the activation and primary-action helpers do not exist.

**Step 3: Implement the minimal pure helpers**

Add a helper that returns the next nodes/workflow for a selected source video and a helper that maps workflow phase to `analyze`, `plan-and-generate`, or `generate`.

**Step 4: Run the test to verify it passes**

Run: `node --test tests/viral-video-native-workflow.test.mjs`

Expected: PASS.

### Task 2: Generalize the optional replacement image

**Files:**
- Modify: `web/src/lib/canvas/viral-video-remake-workflow.ts`
- Modify: `web/src/lib/canvas/viral-video-generation.ts`
- Modify: `web/src/components/canvas/viral-video-remake-canvas-bar.tsx`
- Test: `web/tests/viral-video-generation.test.mjs`

**Step 1: Write the failing tests**

Assert that planning instructions classify a supplied image as a product, person, scene, or prop and that final generation treats it as the sole visual truth for the selected replacement target.

**Step 2: Run the test to verify it fails**

Run: `node --test tests/viral-video-generation.test.mjs`

Expected: FAIL on product-only wording.

**Step 3: Implement minimal wording and UI changes**

Keep the stored field name for scope control, but update placeholder titles, upload labels, setting copy, planner constraints, and final continuity rules.

**Step 4: Run the test to verify it passes**

Run: `node --test tests/viral-video-generation.test.mjs`

Expected: PASS.

### Task 3: Add the native canvas entry

**Files:**
- Modify: `web/src/components/canvas/canvas-toolbar.tsx`
- Modify: `web/src/pages/canvas/project.tsx`
- Test: `web/tests/viral-video-native-workflow.test.mjs`

**Step 1: Write the failing integration assertions**

Assert that the toolbar exposes the button and callback, and that the canvas page activates around the selected video or creates a dedicated workflow when no video is selected.

**Step 2: Run the test to verify it fails**

Run: `node --test tests/viral-video-native-workflow.test.mjs`

Expected: FAIL because the toolbar callback is not wired.

**Step 3: Implement the toolbar and activation handler**

Add the themed button, wire it from `project.tsx`, synchronize refs before auto-analysis, and preserve current user nodes.

**Step 4: Run the test to verify it passes**

Run: `node --test tests/viral-video-native-workflow.test.mjs`

Expected: PASS.

### Task 4: Chain planning into one video submission

**Files:**
- Modify: `web/src/components/canvas/viral-video-remake-canvas-bar.tsx`
- Modify: `web/src/pages/canvas/project.tsx`
- Test: `web/tests/viral-video-native-workflow.test.mjs`

**Step 1: Write the failing integration assertions**

Assert that the analyzed primary action is “一键生成复刻视频”, sets a one-time continuation marker, and successful planning consumes it exactly once before calling the existing single-generation function.

**Step 2: Run the test to verify it fails**

Run: `node --test tests/viral-video-native-workflow.test.mjs`

Expected: FAIL because the current UI still requires a separate prompt-generation click.

**Step 3: Implement the continuation marker and cleanup paths**

Clear the marker on failed planning, cancellation, uploads, or project changes. Keep manual prompt regeneration as a secondary action.

**Step 4: Run the test to verify it passes**

Run: `node --test tests/viral-video-native-workflow.test.mjs`

Expected: PASS.

### Task 5: Document and verify

**Files:**
- Modify: `docs/content/docs/progress/pending-test.mdx`

**Step 1: Record the manual test contract**

Add selected-video activation, automatic analysis, arbitrary replacement image, and plan-to-generation continuation to pending tests.

**Step 2: Run focused and regression tests**

Run: `node --test tests/viral-video-native-workflow.test.mjs tests/viral-video-generation.test.mjs tests/viral-video-analysis-node.test.mjs tests/ecommerce-page.test.mjs`

Expected: all tests pass.

**Step 3: Run static verification**

Run: `npm run typecheck`

Expected: exit 0.

Run: `npm run build`

Expected: exit 0.

**Step 4: Perform the local smoke check**

Open `http://127.0.0.1:3000/canvas/<id>`, confirm the bottom toolbar exposes “爆款复刻”, and confirm the dedicated workflow uses the generalized replacement label and one-click final action.

