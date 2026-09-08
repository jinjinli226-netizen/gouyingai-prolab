# Viral Analysis Node UI Density Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep representative frames visible while replacing the verbose per-frame continuity block with a compact human-readable beat header and one-line boundary summary.

**Architecture:** Change only the analysis-node view model and JSX renderer. Preserve the complete `ViralVideoAnalysis` metadata so semantic state fields remain available to quality checks and video-generation prompts, while exposing only the first-beat label or boundary reason in the visual row.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Node test runner via `tsx`, Vite.

---

### Task 1: Lock the compact row contract with tests

**Files:**
- Modify: `web/tests/viral-video-analysis-node.test.mjs`

**Step 1: Write the failing test**

- Expect `boundarySummary` to be `视频起始` for the first beat and the returned `boundaryReason` for later beats.
- Expect the renderer to include the representative image, compact beat/shot/time title, and `row.boundarySummary`.
- Assert that the renderer no longer includes `节拍边界与状态`, `row.semanticBoundary`, or `row.stateContinuity`.

**Step 2: Run test to verify it fails**

Run: `npx -y tsx --test tests/viral-video-analysis-node.test.mjs`

Expected: FAIL because the current row still exposes verbose semantic and state strings.

### Task 2: Implement the compact representative-frame card

**Files:**
- Modify: `web/src/components/canvas/viral-video-analysis-node-content.tsx`

**Step 1: Write minimal implementation**

- Replace `semanticBoundary` and `stateContinuity` in the display row with `boundarySummary`.
- Derive the first beat as `视频起始`; otherwise use `boundaryReason` with the existing fallback.
- Keep the representative image and `object-contain` rendering.
- Render “动作节拍 N · 真实镜头 M · start–end” and a single truncated boundary line.
- Remove the expanded continuity-state block from JSX only.

**Step 2: Run focused test to verify it passes**

Run: `npx -y tsx --test tests/viral-video-analysis-node.test.mjs`

Expected: PASS.

### Task 3: Document and verify the change

**Files:**
- Modify: `docs/content/docs/progress/pending-test.mdx`

**Step 1: Update manual acceptance notes**

Record that representative frames remain visible, boundary reasons are compact, and hidden state metadata must still affect generation.

**Step 2: Run regression checks**

Run: `npx -y tsx --test tests/*.test.mjs`

Expected: all tests pass.

Run: `npm run typecheck`

Expected: exit code 0.

Run: `npm run build`

Expected: exit code 0; existing bundle-size warnings are acceptable.

**Step 3: Commit**

Skip commit because this checkout has no Git metadata; report the changed files directly.

