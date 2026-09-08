# Universal Remake Post-generation Fidelity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automatically compare every generated universal-remake candidate with its verified source facts, retry bounded fidelity failures with a fact-locked correction, and expose the final fidelity result separately from provider completion.

**Architecture:** Persist one fidelity contract and one source-video artifact per run. After generation or composition, the durable coordinator creates a multimodal `universal-fidelity` job that inspects the source video, generated candidate, storyboard, and source anchors. A deterministic parser computes the score and pass/fail decision from fact IDs; failed facts produce a correction addendum that can reinforce, but never rewrite, the original segment prompt.

**Tech Stack:** TypeScript, Node test runner through tsx, Express, local JSON/Supabase repositories, React, Ant Design.

---

### Task 1: Define and test the fidelity contract

**Files:**
- Create: `gateway/src/universal-viral-remake/fidelity.ts`
- Modify: `gateway/src/universal-viral-remake/types.ts`
- Test: `gateway/tests/universal-remake-fidelity.test.mjs`

1. Write tests for complete fact coverage, unknown/omitted fact IDs, deterministic weighted scoring, critical-fact failure, and fact-locked correction text.
2. Run the focused test and confirm it fails because the evaluator module is absent.
3. Implement the prompt builder and strict result parser.
4. Run the focused test and confirm it passes.

### Task 2: Add durable evaluation and bounded retry

**Files:**
- Modify: `gateway/src/universal-viral-remake/coordinator.ts`
- Modify: `gateway/src/local-store.ts`
- Modify: `gateway/src/universal-viral-remake/repository.ts`
- Modify: `gateway/src/types.ts`
- Modify: `gateway/src/index.ts`
- Test: `gateway/tests/universal-remake-coordinator.test.mjs`

1. Add failing coordinator tests proving provider completion becomes `evaluating`, a fidelity job is persisted, a pass completes the candidate, and a failure retries only up to the configured limit.
2. Extend the candidate state machine with `evaluating` and `fidelity-failed`.
3. Route fidelity jobs through the existing multimodal text runtime.
4. Include the deterministic correction addendum in regenerated segment prompts and unique idempotency keys.
5. Run focused Gateway tests.

### Task 3: Persist and validate run-level fidelity inputs

**Files:**
- Modify: `gateway/src/universal-viral-remake/routes.ts`
- Create: `supabase/supabase/migrations/0007_universal_remake_fidelity.sql`
- Modify: `docs/content/docs/backend/backend-database.mdx`

1. Validate the source artifact, source anchors, fidelity model/channel binding, threshold, retry limit, and verified contract at run creation.
2. Add matching local and Supabase persistence fields.
3. Keep retry policy bounded to 0–3 paid retries per candidate.

### Task 4: Submit and display fidelity policy from the canvas

**Files:**
- Modify: `web/src/types/canvas.ts`
- Modify: `web/src/lib/universal-viral-remake/canvas-adapter.ts`
- Modify: `web/src/pages/canvas/project.tsx`
- Modify: `web/src/services/api/universal-remake-runs.ts`
- Modify: `web/src/components/canvas/universal-remake-run-content.tsx`
- Modify: `web/src/components/canvas/universal-remake-results-content.tsx`
- Test: `web/tests/universal-remake-ui-contract.test.mjs`

1. Persist the source video as a private canvas artifact during evidence analysis without sending it to the generation model.
2. Resolve a native-video text binding at submission and send the run-level fidelity contract.
3. Expose threshold and retry limit, including the worst-case additional generation cost.
4. Show evaluating, passed, retrying, and exhausted states separately from provider status.

### Task 5: Verification and project progress

**Files:**
- Modify: `docs/content/docs/progress/todo.mdx`
- Modify: `docs/content/docs/progress/pending-test.mdx`

1. Run focused Gateway and Web tests.
2. Run the full Web/Gateway suites and type checks; run builds only if required by the final acceptance gate.
3. Record the completed behavior under pending test and remove the matching todo item.
