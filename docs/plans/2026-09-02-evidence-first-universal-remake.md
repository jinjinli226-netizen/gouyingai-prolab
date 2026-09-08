# Evidence-first Universal Remake Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make universal video reconstruction inspect a provider-independent capability catalog, prove coverage with evidence, compile concrete timed prompts, and distinguish generation completion from remake fidelity.

**Architecture:** Schema v3 adds an extensible capability ledger and evidence-backed event facts to each adaptive timeline unit. Reconstruction and independent verification share the same registry and readiness rules; the prompt compiler turns only verified observed facts into timed micro-transitions and derives source-specific negative constraints. Existing binding, batch, and long-video segmentation continue to operate on the verified event graph.

**Tech Stack:** TypeScript, React, Node test runner, Vite, existing Gateway and canvas workflow.

---

### Task 1: Define the universal capability registry and schema v3 event facts

**Files:**
- Create: `web/src/lib/universal-viral-remake/capabilities.ts`
- Modify: `web/src/lib/universal-viral-remake/types.ts`
- Modify: `web/src/lib/universal-viral-remake/index.ts`
- Test: `web/tests/universal-viral-remake-engine.test.mjs`

**Step 1: Write failing tests**

Add tests asserting that:

- schema version is 3;
- the registry includes entity/multiplicity, temporal, spatial, pose/deformation, motion/path, relation/contact, state-transition, camera/edit, scene/treatment, and text/audio families;
- each coverage item has one of `observed`, `not-observed`, `not-applicable`, or `uncertain`;
- observed event facts carry timestamps, participant roles, evidence IDs, importance, and confidence;
- dimension names remain extensible and no product-specific action is present in the registry.

**Step 2: Run the focused test and verify failure**

Run: `npm run test -- --test-name-pattern="capability registry|schema v3"`

Expected: FAIL because schema v3 and registry exports do not exist.

**Step 3: Implement the minimal schema**

Add:

```ts
export type UniversalCoverageStatus = "observed" | "not-observed" | "not-applicable" | "uncertain";

export type UniversalCapabilityFamily =
    | "entity-identity"
    | "temporal-boundary"
    | "spatial-geometry"
    | "pose-deformation"
    | "motion-path"
    | "relation-contact"
    | "state-transition"
    | "camera-edit"
    | "scene-treatment"
    | "text-audio";

export type UniversalEventFact = {
    id: string;
    family: UniversalCapabilityFamily;
    dimension: string;
    predicate: string;
    participantRoles: Array<{ placeholderId: string; role: string }>;
    startSeconds: number;
    endSeconds: number;
    evidenceIds: string[];
    importance: "critical" | "supporting";
    confidence: number;
    beforeState?: string;
    afterState?: string;
};

export type UniversalCapabilityCoverage = {
    family: UniversalCapabilityFamily;
    status: UniversalCoverageStatus;
    factIds: string[];
    reason: string;
};
```

Add `eventFacts` and `capabilityCoverage` to timeline units. Keep dimensions and predicates free-form inside the generic families.

**Step 4: Run focused tests**

Expected: PASS.

**Step 5: Record checkpoint**

Do not create an automatic commit because the surrounding worktree contains unrelated user changes. Record changed files in the task log.

### Task 2: Make reconstruction inspect every capability family without forcing content

**Files:**
- Modify: `web/src/lib/universal-viral-remake/reconstruction.ts`
- Test: `web/tests/universal-viral-remake-engine.test.mjs`

**Step 1: Write failing prompt-contract tests**

Assert that the reconstruction prompt:

- includes the complete registry;
- instructs the model to mark every family explicitly;
- forbids treating the registry as required video content;
- requires physical instance count and multi-view normalization;
- requires event facts to identify initial state, ordered change, and terminal state;
- requires focused facts for orientation, source/destination region, path, contact, and release only when observed or relevant;
- requires timestamped evidence and blocks guessing;
- contains no fixed product, character, container, hook, reveal, or CTA template.

**Step 2: Run the focused tests and verify failure**

Run: `node --test --experimental-strip-types web/tests/universal-viral-remake-engine.test.mjs`

Expected: FAIL on the new prompt assertions.

**Step 3: Update the output contract and prompt**

Build the JSON contract from the shared capability registry. Tell the model to return a coverage entry for every family and only populate event facts from evidence. Explicitly distinguish one object shown from multiple angles from multiple physical instances.

**Step 4: Add strict local validation**

Reject reconstructions when:

- a capability family is missing or duplicated;
- an observed coverage entry has no valid fact IDs;
- a non-observed/non-applicable entry references facts;
- a critical fact is uncertain or lacks evidence;
- a fact lies outside its unit time range;
- participant placeholders do not exist in the unit;
- the timeline has gaps or overlap.

Preserve one conservative repair request for schema or evidence-grounding errors.

**Step 5: Run focused tests**

Expected: PASS.

### Task 3: Upgrade independent verification into a coverage audit

**Files:**
- Modify: `web/src/lib/universal-viral-remake/verification.ts`
- Test: `web/tests/universal-viral-remake-engine.test.mjs`

**Step 1: Write failing verifier tests**

Add tests that reject or repair:

- missing orientation/path/contact facts when evidence and direction establish them;
- an unchecked capability family;
- two physical instances inferred from a single multi-view product reference;
- unsupported hidden mechanics;
- contradictions between direction, event facts, and continuity.

Also test that a static or dialogue-led unit passes with motion/contact marked `not-applicable` or `not-observed`.

**Step 2: Run and verify failure**

Expected: FAIL because the current verifier only checks free-form invariants.

**Step 3: Implement verifier prompt and envelope rules**

Require the verifier to audit each family, identify omitted decisive observations, and return a complete repaired reconstruction when correctable. Sampling gaps alone do not justify invented motion. Critical uncertainty remains a rejection.

**Step 4: Run focused tests**

Expected: PASS.

### Task 4: Add constrained affordance adaptation and multiplicity-safe bindings

**Files:**
- Modify: `web/src/lib/universal-viral-remake/types.ts`
- Modify: `web/src/lib/universal-viral-remake/binding.ts`
- Modify: `web/src/lib/universal-viral-remake/fidelity.ts`
- Test: `web/tests/universal-viral-remake-compiler.test.mjs`

**Step 1: Write failing tests**

Assert that:

- one replacement reference containing front/back views still maps to one physical instance;
- an adaptation may alter only the verified terminal state;
- event order, pose, path topology, contact sequence, timing, and causality cannot change;
- unapproved event-fact changes fail the fidelity gate.

**Step 2: Run and verify failure**

Expected: FAIL because bound templates do not represent adaptations or event-fact diffs.

**Step 3: Implement minimal adaptation types and fidelity comparison**

Add an explicit adaptation record containing reason, source fact ID, allowed target terminal state, and preserved fact IDs. Carry it through binding. Compare event facts and coverage in `compareUniversalRemakeFidelity`.

**Step 4: Run focused tests**

Expected: PASS.

### Task 5: Compile concrete timestamped reverse-engineered prompts

**Files:**
- Modify: `web/src/lib/universal-viral-remake/prompt-compiler.ts`
- Modify: `web/src/lib/universal-viral-remake/batch-compiler.ts`
- Test: `web/tests/universal-viral-remake-compiler.test.mjs`

**Step 1: Write failing compiler tests**

Create a generic physical-event fixture containing back-facing orientation, bent pose, lower-rear source region, downward path, contact, release, and terminal state. Assert that the compiled prompt includes:

- exact timed event facts;
- initial state;
- ordered micro-transitions;
- participant roles and physical instance count;
- source and destination regions;
- contact and release;
- continuity in/out;
- concrete evidence-derived negative constraints such as no front-facing turn and no duplicated receiver;
- the allowed terminal-state adaptation;
- no source identity leakage and no fixed marketing language.

Add a static-video fixture proving the prompt does not invent motion or contact.

**Step 2: Run and verify failure**

Expected: FAIL because the compiler currently emits only prose directions and invariants.

**Step 3: Implement the event-state-machine compiler**

Compile facts in timestamp order and priority order: critical relation/motion, identity/multiplicity, timing/continuity, camera/scene, supporting treatment. Generate negative constraints only from observed or verified contrast facts.

Reject candidate compilation if an observed critical fact cannot be represented.

**Step 4: Run focused tests**

Expected: PASS.

### Task 6: Surface coverage and the complete compiled prompt in the canvas

**Files:**
- Modify: `web/src/components/canvas/universal-remake-analysis-content.tsx`
- Modify: `web/src/components/canvas/universal-remake-template-content.tsx`
- Modify: `web/tests/universal-remake-ui-contract.test.mjs`

**Step 1: Write failing UI contract tests**

Assert that the analysis node exposes coverage summary, unresolved critical facts, physical instance count, and per-event facts. Assert that the template node exposes the complete compiled prompt rather than only the canonical prose summary.

**Step 2: Run and verify failure**

Run: `node --test web/tests/universal-remake-ui-contract.test.mjs`

Expected: FAIL on the new UI contracts.

**Step 3: Implement compact UI rendering**

Show concise observed facts by default and an expandable capability ledger. Keep normal operation uncluttered. Display blockers only for unresolved critical facts.

**Step 4: Run UI contract tests**

Expected: PASS.

### Task 7: Add post-generation fidelity status contract

**Files:**
- Modify: `web/src/lib/universal-viral-remake/types.ts`
- Modify: `web/src/services/api/universal-remake-runs.ts`
- Modify: `web/src/components/canvas/universal-remake-results-content.tsx`
- Modify: `gateway/src/routes/universal-remake-runs.ts` or the actual matching run route located during implementation
- Test: existing Gateway universal-remake run tests
- Test: `web/tests/universal-remake-ui-contract.test.mjs`

**Step 1: Locate the exact Gateway run route and write failing status tests**

Add separate statuses for provider/composition completion and fidelity: `pending`, `passed`, `failed`, or `not-evaluated`. A completed provider job must not automatically display as a fidelity-passed remake.

**Step 2: Run and verify failure**

Expected: FAIL because current run results only expose generation status.

**Step 3: Implement the minimal persisted fidelity result**

Store matched/missing critical fact IDs, mismatch reasons, timing drift, multiplicity issues, and an optional corrected retry prompt. Do not enable automatic paid retry.

**Step 4: Render the separate result state**

Display “生成完成，复刻未校验” or “生成完成，复刻未通过” instead of success when appropriate.

**Step 5: Run focused tests**

Expected: PASS.

### Task 8: Full verification and source regression

**Files:**
- Test: `web/tests/universal-viral-remake-engine.test.mjs`
- Test: `web/tests/universal-viral-remake-compiler.test.mjs`
- Test: `web/tests/universal-remake-ui-contract.test.mjs`
- Test fixture source: `C:/Users/25941/Downloads/test.mp4`

**Step 1: Run all universal-remake tests**

Run: `node --test --experimental-strip-types web/tests/universal-viral-remake-engine.test.mjs web/tests/universal-viral-remake-compiler.test.mjs web/tests/universal-remake-ui-contract.test.mjs`

Expected: PASS.

**Step 2: Run typecheck and build**

Run in `web`: `npm run typecheck`

Run in `web`: `npm run build`

Expected: both exit 0.

**Step 3: Run the complete web test suite**

Run in `web`: `npm test`

Expected: PASS with no regression.

**Step 4: Re-analyze the supplied source video**

Use the running local Gateway and canvas workflow. Verify that the reconstructed event facts capture the actual source evidence instead of any regression-specific production rule. Inspect the compiled prompt for concrete timestamps, orientation, pose, path, contact, release, terminal state, identity multiplicity, and source-specific negative constraints.

**Step 5: Verify batch and long-video invariants**

Compile multiple candidates from one verified template and a source exceeding the model duration. Confirm that candidate variation does not mutate the event graph and that segmentation uses only safe continuation boundaries.

**Step 6: Document evidence**

Record commands, pass counts, runtime reconstruction ID, and any provider limitation. Do not claim visual fidelity if the generated output was not actually re-analyzed.

