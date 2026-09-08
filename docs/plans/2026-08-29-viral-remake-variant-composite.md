# Viral Remake Variant Composite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Represent each viral-remake variation as one complete element-consistent composite node instead of scattering shot and segment prompts across the canvas.

**Architecture:** Extend the prompt plan with a shared element bible and continuity rules, then store the whole plan on one `variant` text node. Render its internal timeline with a dedicated React component, simplify final-plan collection to read one node per plan, and migrate legacy prompt graphs without new model calls.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Zustand canvas persistence, Node test runner through `tsx`, Vite.

---

### Task 1: Define and enforce scheme-level element variation

**Files:**
- Modify: `web/src/lib/canvas/viral-video-remake-workflow.ts`
- Modify: `web/src/lib/canvas/viral-video-generation.ts`
- Test: `web/tests/viral-video-generation.test.mjs`

**Step 1: Write failing tests**

- Require planner JSON to contain character, product, scene and content plans plus global continuity rules.
- Assert planner instructions prohibit shot-level element re-randomization.
- Assert the final video prompt carries the shared element plan and continuity rules.

**Step 2: Run the focused test and confirm RED**

Run: `npx -y tsx --test tests/viral-video-generation.test.mjs`

**Step 3: Implement the minimal schema, parser and prompt changes**

- Add `elementPlan` and `continuityRules` to `ViralVideoPromptPlan`.
- Parse every new field as required non-empty text.
- Include the fields in formatted records and final generation prompts.

**Step 4: Run the focused test and confirm GREEN**

### Task 2: Build one composite node per complete remake scheme

**Files:**
- Create: `web/src/lib/canvas/viral-video-variant-node.ts`
- Create: `web/src/components/canvas/viral-video-variant-node-content.tsx`
- Modify: `web/src/types/canvas.ts`
- Modify: `web/src/components/canvas/canvas-node.tsx`
- Test: `web/tests/viral-video-variant-node.test.mjs`

**Step 1: Write failing tests**

- Assert a 14-shot plan creates exactly one node with role `variant`.
- Assert the composite renderer exposes four element sections, continuity, timeline and editable master prompt.
- Assert custom content rendering and regular text editing correctly recognize the new role.

**Step 2: Run the focused test and confirm RED**

Run: `npx -y tsx --test tests/viral-video-variant-node.test.mjs`

**Step 3: Implement builder and workspace UI**

- Store the complete plan, planner prompt, plan ID and scheme index on one fixed-size text node.
- Render one continuous workspace surface with compact element columns and internally scrolling timeline.
- Keep the master prompt editable through the existing canvas state update path.

**Step 4: Run the focused test and confirm GREEN**

### Task 3: Replace scattered plan generation and final-plan collection

**Files:**
- Modify: `web/src/pages/canvas/project.tsx`
- Modify: `web/src/components/canvas/viral-video-remake-canvas-bar.tsx`
- Test: `web/tests/viral-video-analysis-node.test.mjs`
- Test: `web/tests/viral-video-native-workflow.test.mjs`

**Step 1: Write failing integration tests**

- Assert plan generation calls the variant-node builder once per successful scheme and no longer maps shots or segments into nodes.
- Assert active plan collection reads `variant` nodes directly.
- Assert user-facing copy says “复刻方案” and “复刻方案数”.

**Step 2: Run focused tests and confirm RED**

**Step 3: Implement the new graph and collector**

- Create one node and minimal connections per scheme.
- Remove invalidated prompt nodes before adding new ones.
- Derive final segment execution data from the plan stored on the composite node.
- Update interrupted-run normalization and editable master-prompt handling.

**Step 4: Run focused tests and confirm GREEN**

### Task 4: Migrate existing scattered prompt graphs

**Files:**
- Modify: `web/src/lib/canvas/viral-video-variant-node.ts`
- Modify: `web/src/pages/canvas/project.tsx`
- Test: `web/tests/viral-video-variant-node.test.mjs`

**Step 1: Write a failing legacy migration test**

- Build one old plan containing shot, segment, master and record nodes.
- Expect one composite variant node, old prompt nodes removed, connections rewired and workflow IDs updated.

**Step 2: Run the test and confirm RED**

**Step 3: Implement deterministic graph compaction**

- Group active old nodes by plan ID.
- Preserve the latest master prompt and normalize legacy element fields.
- Remove all obsolete legacy prompt nodes and deduplicate rewired connections.
- Apply the compaction during project restore without model calls.

**Step 4: Run the test and confirm GREEN**

### Task 5: Documentation and verification

**Files:**
- Modify: `docs/content/docs/progress/pending-test.mdx`

**Step 1: Record manual acceptance coverage**

Document one-node-per-scheme behavior, legacy migration, internal 14-shot scrolling and one-paid-task-per-scheme semantics.

**Step 2: Run regression checks**

Run: `npx -y tsx --test tests/*.test.mjs`

Run: `npm run typecheck`

Run: `npm run build`

Expected: all commands exit 0; existing Vite chunk-size warnings are acceptable.

**Step 3: Commit**

Skip commit because this checkout has no Git metadata; report changed files directly.

