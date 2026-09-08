# Viral Remake Master Template and Configurable Batch Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade GouYingAI viral-video remake into a fidelity-gated master-template workflow that automatically recognizes source and uploaded objects, preserves the complete source timeline, and can generate a user-selected 1–1000 complete candidates through a durable batch queue.

**Architecture:** Replace plan-level variants with one structured `ViralRemakeTemplate`, then compile controlled candidate manifests from that immutable template. Add dual object fingerprinting and automatic bindings before templating, persist large batch runs in the Gateway, and evaluate every completed candidate against required source events before presenting it in a single results-library node.

**Tech Stack:** React 19, TypeScript, Zustand, Ant Design 6, Tailwind CSS, localforage, Node test runner/tsx, Express Gateway, Supabase PostgreSQL, existing canvas artifact and durable job systems.

**Implementation status:** Tasks 1–15 implemented locally. Automated verification uses mocked/no-cost generation only; real provider quality and billing remain an explicit manual acceptance step.

---

## Product invariants

- The user-facing product exposes one mode: **爆款复刻**. Standard and custom model routes are internal execution strategies, not separate creative modes.
- A run always starts from one immutable master template. `count` means complete candidate videos, never “镜头变体” or independently rewritten scripts.
- Generation count defaults to `1`, accepts `1–1000`, and never silently expands.
- Uploaded replacement material is optional. When present, the system recognizes its role and binds it to source objects; uncertainty is shown for confirmation instead of guessed.
- The default target duration equals the source duration. Shortening is allowed only through an explicit compression strategy that preserves every P0 event.
- The system must not submit paid generation until analysis, binding, template coverage, duration feasibility, and cost preflight all pass.
- Retries and batch expansion require explicit authorization and a configured ceiling.

## Delivery milestones

1. **Milestone A — Fidelity core (Tasks 1–6):** structured recognition, bindings, master template, must-keep event coverage, and duration feasibility.
2. **Milestone B — Durable batch (Tasks 7–10):** deterministic candidate compilation, persistent batches, bounded scheduling, and paginated results.
3. **Milestone C — Product readiness (Tasks 11–15):** simplified canvas cards, state machine, quality scoring, spend safety, regression coverage, and documentation.

Do not begin Milestone B until the supplied reference-video regression passes the Milestone A coverage gate. Do not enable paid large-batch submission until all Milestone C safety tests pass.

## Task 1: Introduce the viral-remake domain contracts

**Files:**

- Create: `web/src/lib/canvas/viral-video-domain.ts`
- Modify: `web/src/types/canvas.ts`
- Modify: `web/src/lib/canvas/viral-video-remake-workflow.ts`
- Test: `web/tests/viral-video-domain.test.mjs`

**Step 1: Write the failing test**

Cover the new contracts and normalization rules:

```js
test('normalizes candidate count to the supported range', async () => {
  const { normalizeViralCandidateCount } = await import('../src/lib/canvas/viral-video-domain.ts')
  assert.equal(normalizeViralCandidateCount(undefined), 1)
  assert.equal(normalizeViralCandidateCount(0), 1)
  assert.equal(normalizeViralCandidateCount(1001), 1000)
})
```

Also instantiate minimal valid examples of `ViralObjectFingerprint`, `ViralReplacementBinding`, `ViralMustKeepEvent`, `ViralRemakeTemplate`, `ViralBatchRecipe`, `ViralCandidateManifest`, `ViralCoverageReport`, and `ViralQualityReport` through exported validators/builders.

**Step 2: Run the test and verify it fails**

Run from `web/`:

```bash
npx -y tsx --test tests/viral-video-domain.test.mjs
```

Expected: FAIL because the domain module and validators do not exist.

**Step 3: Implement the smallest complete domain layer**

- Add stable IDs and schema-version fields to persisted records.
- Define P0/P1/P2 event priority, object roles, binding confidence, source evidence, candidate status, and quality dimensions.
- Make `ViralRemakeTemplate` the only reusable creative blueprint.
- Remove plan-level `variantCount` semantics from the workflow contract; retain only `candidateCount` in the batch recipe.
- Keep domain helpers pure and independent of React, canvas nodes, and network calls.

**Step 4: Run the focused test and typecheck**

```bash
npx -y tsx --test tests/viral-video-domain.test.mjs
npm run typecheck
```

Expected: PASS with no legacy variant field required by the new workflow.

**Step 5: Commit**

```bash
git add web/src/lib/canvas/viral-video-domain.ts web/src/types/canvas.ts web/src/lib/canvas/viral-video-remake-workflow.ts web/tests/viral-video-domain.test.mjs
git commit -m "feat: add viral remake domain contracts"
```

## Task 2: Extract source objects and must-keep events from the complete video

**Files:**

- Create: `web/src/lib/canvas/viral-video-object-recognition.ts`
- Modify: `web/src/lib/canvas/viral-video-remake-workflow.ts`
- Modify: `web/src/pages/canvas/project.tsx`
- Test: `web/tests/viral-video-source-recognition.test.mjs`

**Step 1: Write the failing tests**

Add fixtures for a continuous video whose important events include an opening disturbance, product avalanche, character reveal, product demonstration, and CTA. Assert that analysis:

- produces stable object fingerprints for people, products, props, vehicles, wardrobe, and locations;
- attaches timestamped frame/audio evidence;
- creates ordered must-keep events covering opening, middle payoff, product proof, and ending;
- marks the destructive spectacle as P0 instead of collapsing the whole clip into one generic scene.

```js
assert.deepEqual(result.mustKeepEvents.map(event => event.function), [
  'hook', 'spectacle', 'reveal', 'product_proof', 'cta'
])
assert.equal(result.mustKeepEvents.every(event => event.startSec < event.endSec), true)
```

**Step 2: Run the test and verify it fails**

```bash
npx -y tsx --test tests/viral-video-source-recognition.test.mjs
```

Expected: FAIL because current analysis returns rough replacement elements and shot prose, not evidence-backed objects/events.

**Step 3: Implement structured source recognition**

- Preserve Gemini raw-video input when available.
- For frame-only models, sample by semantic coverage rather than a fixed uniform-only set: opening, motion discontinuities, visual peaks, product close-ups, and ending.
- Add an audio evidence lane (ASR/transcript, music/SFX cues, silence) instead of pretending frame-only analysis has heard the source.
- Require the model response to return object fingerprints, representative-frame timestamps, wardrobe states, event boundaries, narrative function, and P0/P1/P2 priority.
- Validate timestamps against source duration and repair only obvious formatting errors; surface semantic gaps as blockers.

**Step 4: Run focused tests**

```bash
npx -y tsx --test tests/viral-video-source-recognition.test.mjs
npx -y tsx --test tests/viral-video-native-workflow.test.mjs
```

Expected: PASS; the reference event list remains ordered and covers the full source duration.

**Step 5: Commit**

```bash
git add web/src/lib/canvas/viral-video-object-recognition.ts web/src/lib/canvas/viral-video-remake-workflow.ts web/src/pages/canvas/project.tsx web/tests/viral-video-source-recognition.test.mjs
git commit -m "feat: recognize source objects and must keep events"
```

## Task 3: Recognize uploaded replacement materials automatically

**Files:**

- Create: `web/src/lib/canvas/viral-video-upload-recognition.ts`
- Modify: `web/src/components/canvas/viral-video-replacement-library-node-content.tsx`
- Modify: `web/src/lib/canvas/viral-video-remake-workflow.ts`
- Test: `web/tests/viral-video-upload-recognition.test.mjs`

**Step 1: Write the failing tests**

Use fixtures representing a phone case product image, a person reference, a location reference, and multiple angles of one product. Assert:

- role and visible attributes are inferred without a manual description;
- multiple views of the same object merge into one fingerprint while retaining all asset IDs;
- recognition failure keeps the uploaded asset and records `needsConfirmation: true`;
- an absent upload remains valid because replacement material is optional.

**Step 2: Run the test and verify it fails**

```bash
npx -y tsx --test tests/viral-video-upload-recognition.test.mjs
```

Expected: FAIL because uploads are currently attached only to a manually selected replacement card.

**Step 3: Implement upload recognition**

- Build an image-recognition request returning kind, proposed label, distinguishing features, color/material, viewpoint, and confidence.
- Group multi-angle images with conservative similarity rules; never merge ambiguous people or products automatically.
- Store original asset references separately from inferred metadata.
- Replace misleading “由上传素材自动识别” copy with actual recognition state: recognizing, recognized, needs confirmation, or failed safely.

**Step 4: Run focused tests**

```bash
npx -y tsx --test tests/viral-video-upload-recognition.test.mjs
npx -y tsx --test tests/viral-video-native-workflow.test.mjs
```

Expected: PASS; optional uploads and failed recognition do not destroy user assets.

**Step 5: Commit**

```bash
git add web/src/lib/canvas/viral-video-upload-recognition.ts web/src/components/canvas/viral-video-replacement-library-node-content.tsx web/src/lib/canvas/viral-video-remake-workflow.ts web/tests/viral-video-upload-recognition.test.mjs
git commit -m "feat: recognize viral remake replacement assets"
```

## Task 4: Bind recognized uploads to source objects

**Files:**

- Create: `web/src/lib/canvas/viral-video-object-binding.ts`
- Modify: `web/src/lib/canvas/viral-video-remake-workflow.ts`
- Modify: `web/src/components/canvas/viral-video-replacement-library-node-content.tsx`
- Test: `web/tests/viral-video-object-binding.test.mjs`

**Step 1: Write the failing tests**

Cover binding precedence and ambiguity:

```js
assert.equal(bind({ explicit: 'upload-2', inferred: 'upload-1' }).uploadId, 'upload-2')
assert.equal(bindSingleHeroProduct(source, [phoneCase]).status, 'bound')
assert.equal(bindAmbiguousCharacters(source, [personA, personB]).status, 'needs_confirmation')
```

Assert that product bindings apply to every source appearance of that product, not one selected shot.

**Step 2: Run the test and verify it fails**

```bash
npx -y tsx --test tests/viral-video-object-binding.test.mjs
```

Expected: FAIL because no binding engine exists.

**Step 3: Implement conservative automatic binding**

- Precedence: explicit user binding → unique semantic role match → unique hero-product match → confidence-ranked suggestion → confirmation required.
- Record why each binding was chosen and which source events it affects.
- Never bind one upload to incompatible source roles.
- Make a conflicting or missing required binding block template compilation, while unbound optional source objects remain unchanged.

**Step 4: Run focused tests**

```bash
npx -y tsx --test tests/viral-video-object-binding.test.mjs
npx -y tsx --test tests/viral-video-domain.test.mjs
```

Expected: PASS with deterministic binding results.

**Step 5: Commit**

```bash
git add web/src/lib/canvas/viral-video-object-binding.ts web/src/lib/canvas/viral-video-remake-workflow.ts web/src/components/canvas/viral-video-replacement-library-node-content.tsx web/tests/viral-video-object-binding.test.mjs
git commit -m "feat: bind replacement assets to source objects"
```

## Task 5: Compile one master template and enforce event coverage

**Files:**

- Create: `web/src/lib/canvas/viral-video-template.ts`
- Create: `web/src/components/canvas/viral-video-template-node-content.tsx`
- Modify: `web/src/lib/canvas/viral-video-remake-workflow.ts`
- Modify: `web/src/pages/canvas/project.tsx`
- Delete: `web/src/lib/canvas/viral-video-variant-node.ts`
- Delete: `web/src/components/canvas/viral-video-variant-node-content.tsx`
- Delete: `web/tests/viral-video-variant-node.test.mjs` after all imports are migrated
- Test: `web/tests/viral-video-template.test.mjs`

**Step 1: Write the failing tests**

Build a master template from the structured source analysis and bindings. Assert:

- every P0 event appears exactly once in the event timeline;
- source event order is preserved unless a declared adaptation rule explains the change;
- character identity, wardrobe state, product state, location state, camera intent, dialogue, subtitles, music, and SFX have explicit continuity fields;
- a template omitting the truck opening/explosion event is rejected;
- the output is one template, not an array of “14镜头变体”.

```js
const coverage = evaluateTemplateCoverage(template, source.mustKeepEvents)
assert.equal(coverage.missingP0.length, 0)
assert.equal(coverage.canGenerate, true)
```

**Step 2: Run the test and verify it fails**

```bash
npx -y tsx --test tests/viral-video-template.test.mjs
```

Expected: FAIL because current plans are loosely structured per-shot variants and have no strict coverage gate.

**Step 3: Implement the master-template compiler**

- Compile an immutable event timeline from source events and bindings.
- Add character bible, wardrobe timeline, environment bible, product-state timeline, audio map, subtitle/voiceover text, continuity anchors, and generation-route hints.
- Store source evidence on each template event so later QA can compare intent to output.
- Return blocking diagnostics for missing P0 events, impossible bindings, temporal overlap, or ungrounded new events.
- Remove legacy variant terminology and delete the old variant UI path rather than maintaining a second product model.

**Step 4: Run focused tests**

```bash
npx -y tsx --test tests/viral-video-template.test.mjs
npx -y tsx --test tests/viral-video-native-workflow.test.mjs
```

Expected: PASS; the explosion/avalanche regression cannot compile when any P0 event is absent.

**Step 5: Commit**

```bash
git add web/src/lib/canvas/viral-video-template.ts web/src/components/canvas/viral-video-template-node-content.tsx web/src/lib/canvas/viral-video-remake-workflow.ts web/src/pages/canvas/project.tsx web/tests/viral-video-template.test.mjs
git add -u web/src/lib/canvas/viral-video-variant-node.ts web/src/components/canvas/viral-video-variant-node-content.tsx web/tests/viral-video-variant-node.test.mjs
git commit -m "feat: compile fidelity gated viral remake templates"
```

## Task 6: Preserve full duration and compress only with explicit rules

**Files:**

- Create: `web/src/lib/canvas/viral-video-duration.ts`
- Modify: `web/src/lib/canvas/viral-video-template.ts`
- Modify: `web/src/components/canvas/viral-video-template-node-content.tsx`
- Test: `web/tests/viral-video-duration.test.mjs`

**Step 1: Write the failing tests**

Cover four cases:

1. no target duration supplied → target equals source duration;
2. model supports full duration → one complete execution segment;
3. route has a shorter maximum → compiler creates contiguous internal segments with overlap/continuity instructions;
4. requested compression cannot retain all P0 events → block, never silently delete the spectacle or CTA.

```js
assert.equal(resolveTargetDuration({ sourceDurationSec: 23.625 }).targetDurationSec, 23.625)
assert.equal(compressTimeline(impossibleTemplate, 15).status, 'blocked')
```

**Step 2: Run the test and verify it fails**

```bash
npx -y tsx --test tests/viral-video-duration.test.mjs
```

Expected: FAIL because current UI can force a fixed 15-second request without proving event coverage.

**Step 3: Implement duration feasibility**

- Default to source duration and preserve relative event timing.
- Add route capability metadata: maximum duration, audio support, reference-image limits, and continuation support.
- Split only at semantic boundaries; maintain character/product/location anchors across internal segments.
- Treat internal segmentation as an execution detail. The user still receives one complete candidate.
- Require an explicit compression choice and display which non-P0 beats were shortened.

**Step 4: Run focused tests**

```bash
npx -y tsx --test tests/viral-video-duration.test.mjs
npx -y tsx --test tests/viral-video-template.test.mjs
```

Expected: PASS; no supported path silently truncates the source.

**Step 5: Commit**

```bash
git add web/src/lib/canvas/viral-video-duration.ts web/src/lib/canvas/viral-video-template.ts web/src/components/canvas/viral-video-template-node-content.tsx web/tests/viral-video-duration.test.mjs
git commit -m "feat: preserve viral remake duration and events"
```

## Milestone A gate

Before continuing, run all fidelity-core tests and manually inspect one no-cost compiled template for the supplied truck/product-avalanche reference:

```bash
npx -y tsx --test tests/viral-video-domain.test.mjs tests/viral-video-source-recognition.test.mjs tests/viral-video-upload-recognition.test.mjs tests/viral-video-object-binding.test.mjs tests/viral-video-template.test.mjs tests/viral-video-duration.test.mjs
```

Pass condition: the template contains all P0 events, the product replacement is bound across all appearances, wardrobe changes are explicit, audio/subtitle intent is retained, and target duration is not silently reduced.

## Task 7: Compile controlled candidate manifests from the master template

**Files:**

- Create: `web/src/lib/canvas/viral-video-batch-compiler.ts`
- Modify: `web/src/lib/canvas/viral-video-domain.ts`
- Test: `web/tests/viral-video-batch-compiler.test.mjs`

**Step 1: Write the failing tests**

Assert that candidate compilation:

- defaults to one candidate and supports up to 1000;
- preserves every fixed field and P0 event;
- varies only declared slots such as hook wording, camera micro-variation, approved background, supporting performer, or CTA phrasing;
- distributes categorical combinations before using seed-only microvariation;
- emits stable candidate indices and deterministic manifests for the same recipe/seed;
- keeps the same replacement product and primary character throughout one candidate.

**Step 2: Run the test and verify it fails**

```bash
npx -y tsx --test tests/viral-video-batch-compiler.test.mjs
```

Expected: FAIL because the current count produces separately rewritten plan variants.

**Step 3: Implement the controlled compiler**

- Separate `fixed`, `replaceable`, and `variable` fields in the template.
- Compile a manifest for each requested index from the immutable template plus `ViralBatchRecipe`.
- Cover user-approved categorical values with a deterministic combination strategy, then add bounded seed/camera microvariation.
- Re-run template coverage on every manifest; reject any manifest that mutates a fixed field or loses a P0 event.
- Compute a content hash for idempotent submission.

**Step 4: Run focused tests**

```bash
npx -y tsx --test tests/viral-video-batch-compiler.test.mjs
npx -y tsx --test tests/viral-video-template.test.mjs
```

Expected: PASS for count 1, a mixed 12-candidate recipe, and a memory-bounded 1000-manifest iterator.

**Step 5: Commit**

```bash
git add web/src/lib/canvas/viral-video-batch-compiler.ts web/src/lib/canvas/viral-video-domain.ts web/tests/viral-video-batch-compiler.test.mjs
git commit -m "feat: compile controlled viral remake candidates"
```

## Task 8: Persist durable viral batches in local and Supabase stores

**Files:**

- Create: `supabase/supabase/migrations/0005_gouyingai_viral_batches.sql`
- Create: `gateway/src/viral-batch-repository.ts`
- Create: `gateway/src/viral-batch-routes.ts`
- Modify: `gateway/src/types.ts`
- Modify: `gateway/src/local-store.ts`
- Modify: `gateway/src/index.ts`
- Modify: `gateway/src/canvas-job-repository.ts`
- Test: `gateway/tests/viral-batch-repository.test.mjs`
- Test: `gateway/tests/viral-batch-routes.test.mjs`

**Step 1: Write the failing tests**

Specify a batch record with template snapshot/hash, recipe, requested count, materialized count, status counters, spend ceiling, retry policy, and timestamps. Verify:

- local and Supabase-shaped repositories expose the same behavior;
- candidate jobs carry `batch_id` and `candidate_index`;
- `(batch_id, candidate_index)` is unique;
- list endpoints paginate rather than returning 1000 embedded jobs;
- pause/cancel updates do not delete completed artifacts.

**Step 2: Run the tests and verify they fail**

Run from `gateway/`:

```bash
npx tsx --test tests/viral-batch-repository.test.mjs tests/viral-batch-routes.test.mjs
```

Expected: FAIL because only flat canvas jobs exist today.

**Step 3: Add schema, repository, and routes**

- Add `viral_batches` and the minimal candidate linkage/indexes.
- Support local JSON persistence and Supabase persistence through one repository interface.
- Add create/get/list/pause/resume/cancel routes plus paginated candidate summaries.
- Persist the immutable template snapshot and recipe used for the run.
- Use idempotency keys so a repeated create request returns the same batch instead of billing twice.

**Step 4: Run focused tests and Gateway build**

```bash
npx tsx --test tests/viral-batch-repository.test.mjs tests/viral-batch-routes.test.mjs
npm run build
```

Expected: PASS in local-store mode; Supabase adapter query shapes match the migration.

**Step 5: Commit**

```bash
git add supabase/supabase/migrations/0005_gouyingai_viral_batches.sql gateway/src/viral-batch-repository.ts gateway/src/viral-batch-routes.ts gateway/src/types.ts gateway/src/local-store.ts gateway/src/index.ts gateway/src/canvas-job-repository.ts gateway/tests/viral-batch-repository.test.mjs gateway/tests/viral-batch-routes.test.mjs
git commit -m "feat: persist durable viral remake batches"
```

## Task 9: Add a bounded, resumable batch coordinator

**Files:**

- Create: `gateway/src/viral-batch-coordinator.ts`
- Modify: `gateway/src/canvas-job-runner.ts`
- Modify: `gateway/src/index.ts`
- Modify: `gateway/src/viral-batch-routes.ts`
- Test: `gateway/tests/viral-batch-coordinator.test.mjs`

**Step 1: Write the failing tests**

Use fake jobs and a fake clock to verify:

- a 1000-candidate batch materializes only a small configured window;
- completing a candidate opens exactly one new slot;
- restart/reconciliation resumes without duplicate indices;
- pause stops new materialization but lets an in-flight job settle;
- cancel prevents new work and preserves completed results;
- one failed candidate does not crash the coordinator;
- retry creation respects explicit authorization and per-batch limits.

**Step 2: Run the test and verify it fails**

```bash
npx tsx --test tests/viral-batch-coordinator.test.mjs
```

Expected: FAIL because the existing runner knows job concurrency but not batch-level demand and lifecycle.

**Step 3: Implement bounded scheduling**

- Reuse the existing canvas job runner and global concurrency settings.
- Materialize candidate jobs lazily from the stored recipe/template.
- Use an atomic claim/idempotent insert strategy for each candidate index.
- Reconcile batch counters from jobs instead of trusting client-side progress.
- Register actual durable handlers for existing `viral-analysis` and `viral-plan` job kinds while adding the batch coordinator; avoid leaving route types without handlers.
- Keep coordinator ticks cheap and independently restartable.

**Step 4: Run focused tests and all Gateway tests**

```bash
npx tsx --test tests/viral-batch-coordinator.test.mjs
npm test
```

Expected: PASS with no duplicate candidate jobs after simulated restarts.

**Step 5: Commit**

```bash
git add gateway/src/viral-batch-coordinator.ts gateway/src/canvas-job-runner.ts gateway/src/index.ts gateway/src/viral-batch-routes.ts gateway/tests/viral-batch-coordinator.test.mjs
git commit -m "feat: coordinate bounded viral remake batches"
```

## Task 10: Add the web batch API, store, and results-library contract

**Files:**

- Create: `web/src/types/viral-batch.ts`
- Create: `web/src/services/api/viral-batches.ts`
- Create: `web/src/stores/canvas/use-viral-batch-store.ts`
- Create: `web/src/lib/canvas/viral-video-results-node.ts`
- Modify: `web/src/services/api/canvas-jobs.ts`
- Modify: `web/src/stores/canvas/use-canvas-job-store.ts`
- Test: `web/tests/viral-batch-store.test.mjs`
- Test: `web/tests/viral-video-results-node.test.mjs`

**Step 1: Write the failing tests**

Verify that the web layer:

- submits template snapshot/hash, recipe, count, cost authorization, and idempotency key;
- stores only compact batch summaries and user preferences in Zustand/localforage;
- paginates candidate summaries on demand;
- reconciles server truth after reload;
- updates one results-library node rather than creating hundreds of canvas nodes;
- preserves selected filters and candidate selection without persisting video blobs.

**Step 2: Run the tests and verify they fail**

```bash
npx -y tsx --test tests/viral-batch-store.test.mjs tests/viral-video-results-node.test.mjs
```

Expected: FAIL because no batch API/store or results-node contract exists.

**Step 3: Implement compact client state**

- Add typed API methods for create/get/list/pause/resume/cancel and candidate pagination.
- Reconcile progress from Gateway counters and canvas artifacts.
- Store `batchId`, compact status, filters, and selected candidate; fetch result pages lazily.
- Keep the canvas node payload bounded regardless of requested count.
- Reuse existing canvas artifact and job-center conventions.

**Step 4: Run focused tests and typecheck**

```bash
npx -y tsx --test tests/viral-batch-store.test.mjs tests/viral-video-results-node.test.mjs
npm run typecheck
```

Expected: PASS; a mocked 1000-result batch does not create 1000 canvas nodes or persist 1000 media payloads.

**Step 5: Commit**

```bash
git add web/src/types/viral-batch.ts web/src/services/api/viral-batches.ts web/src/stores/canvas/use-viral-batch-store.ts web/src/lib/canvas/viral-video-results-node.ts web/src/services/api/canvas-jobs.ts web/src/stores/canvas/use-canvas-job-store.ts web/tests/viral-batch-store.test.mjs web/tests/viral-video-results-node.test.mjs
git commit -m "feat: add viral batch client and results contract"
```

## Milestone B gate

Run a mocked 1000-candidate batch with paid handlers replaced by deterministic fakes. Demonstrate pause, reload, resume, cancel, paginated results, bounded materialization, and zero duplicate candidate indices. Do not call a paid video provider for this gate.

## Task 11: Replace the dense workflow UI with five purpose-built canvas cards

**Files:**

- Create: `web/src/components/canvas/viral-video-requirements-node-content.tsx`
- Modify: `web/src/components/canvas/viral-video-analysis-node-content.tsx`
- Modify: `web/src/components/canvas/viral-video-replacement-library-node-content.tsx`
- Modify: `web/src/components/canvas/viral-video-template-node-content.tsx`
- Create: `web/src/components/canvas/viral-video-batch-node-content.tsx`
- Create: `web/src/components/canvas/viral-video-results-node-content.tsx`
- Modify: `web/src/components/canvas/viral-video-remake-canvas-bar.tsx`
- Modify: `web/src/pages/canvas/project.tsx`
- Test: `web/tests/viral-remake-ui-contract.test.mjs`

**Step 1: Write the failing UI-contract test**

Assert the rendered workflow exposes these five conceptual cards:

1. reference and requirements;
2. recognized objects and optional replacement materials;
3. complete master-template timeline;
4. count/cost/generation controls;
5. paginated results and QA.

Also assert:

- representative images use resolvable asset URLs and have a fallback state;
- “节拍边界与形态” is shown once at event level, not repeated as an unexplained label on every image;
- cards have draggable handles and interactive controls use `nodrag`/event isolation;
- no user-facing “生成 14 个镜头变体” copy remains;
- generation count defaults to 1 and accepts 1–1000;
- replacement uploads are optional and support multiple person/product/scene/prop assets.

**Step 2: Run the test and verify it fails**

```bash
npx -y tsx --test tests/viral-remake-ui-contract.test.mjs
```

Expected: FAIL against the current dense six-column analysis layout and legacy variant controls.

**Step 3: Implement the simplified cards**

- Keep the default card view scannable; move evidence and advanced fields into expandable details.
- Show representative frames beside event title/time/function, with explicit loading/error fallback.
- Present source objects and recognized uploads in one large optional-material card with automatic binding chips and only ambiguous cases requiring confirmation.
- Present a single ordered master timeline with visible P0 badges, continuity anchors, audio, and coverage result.
- Present count, internal route recommendation, exact preflight cost, and authorization in the batch card.
- Present status filters, thumbnail/list view, quality score, missing-event warning, preview, download, and rerun action in one results-library node.
- Preserve canvas drag behavior by putting drag handles outside scrollable form regions.

**Step 4: Run focused tests, typecheck, and visual QA**

```bash
npx -y tsx --test tests/viral-remake-ui-contract.test.mjs
npm run typecheck
```

Then open the workflow at common zoom levels and verify images, scrolling, dragging, focus, and responsive card widths manually.

**Step 5: Commit**

```bash
git add web/src/components/canvas/viral-video-requirements-node-content.tsx web/src/components/canvas/viral-video-analysis-node-content.tsx web/src/components/canvas/viral-video-replacement-library-node-content.tsx web/src/components/canvas/viral-video-template-node-content.tsx web/src/components/canvas/viral-video-batch-node-content.tsx web/src/components/canvas/viral-video-results-node-content.tsx web/src/components/canvas/viral-video-remake-canvas-bar.tsx web/src/pages/canvas/project.tsx web/tests/viral-remake-ui-contract.test.mjs
git commit -m "feat: simplify the viral remake canvas workflow"
```

## Task 12: Make workflow transitions explicit and invalidate downstream data correctly

**Files:**

- Create: `web/src/lib/canvas/viral-video-state-machine.ts`
- Modify: `web/src/lib/canvas/viral-video-remake-workflow.ts`
- Modify: `web/src/pages/canvas/project.tsx`
- Test: `web/tests/viral-video-state-machine.test.mjs`

**Step 1: Write the failing tests**

Cover the legal state progression:

```text
idle → recognizing → requirements_ready → templating → template_ready
→ compiling → ready_to_submit → running → partial|completed|paused|failed
```

Assert invalidation behavior:

- changing reference video invalidates recognition, bindings, template, recipe, and batch preflight;
- changing one upload invalidates its recognition/binding and all downstream compiled manifests;
- changing count invalidates only cost/preflight and pending manifests, not source analysis;
- a running batch is immutable; edits create a new draft revision instead of mutating submitted work.

**Step 2: Run the test and verify it fails**

```bash
npx -y tsx --test tests/viral-video-state-machine.test.mjs
```

Expected: FAIL because state is currently coordinated ad hoc in the page.

**Step 3: Implement the pure transition function**

- Add `transitionViralWorkflow(state, event)` with explicit legal transitions and revision IDs.
- Centralize dependency invalidation.
- Derive button enabled/disabled state from the machine instead of scattered conditions.
- Persist submitted snapshots separately from editable drafts.

**Step 4: Run focused tests**

```bash
npx -y tsx --test tests/viral-video-state-machine.test.mjs
npx -y tsx --test tests/viral-video-native-workflow.test.mjs
```

Expected: PASS; stale template/manifests cannot be submitted after an upstream edit.

**Step 5: Commit**

```bash
git add web/src/lib/canvas/viral-video-state-machine.ts web/src/lib/canvas/viral-video-remake-workflow.ts web/src/pages/canvas/project.tsx web/tests/viral-video-state-machine.test.mjs
git commit -m "refactor: make viral remake workflow transitions explicit"
```

## Task 13: Evaluate generated candidates against the source and template

**Files:**

- Create: `web/src/lib/canvas/viral-video-quality.ts`
- Create: `gateway/src/canvas-job-handlers/viral-quality.ts`
- Modify: `gateway/src/index.ts`
- Modify: `gateway/src/types.ts`
- Modify: `web/src/components/canvas/viral-video-results-node-content.tsx`
- Test: `web/tests/viral-video-quality.test.mjs`
- Test: `gateway/tests/viral-quality-handler.test.mjs`

**Step 1: Write the failing tests**

Score candidates with this fixed rubric:

- required-event coverage: 30;
- timeline/beat fidelity: 20;
- character and wardrobe consistency: 15;
- product identity and demonstration fidelity: 15;
- dialogue/subtitle/music/SFX fidelity: 10;
- visual/camera/style similarity: 10.

Assert that a candidate missing any P0 event is capped at 79 even if its visual similarity is high. Assert that the report includes timestamped evidence, reason codes, and suggested repair scope instead of only one opaque score.

**Step 2: Run the tests and verify they fail**

```bash
cd web
npx -y tsx --test tests/viral-video-quality.test.mjs
cd ../gateway
npx tsx --test tests/viral-quality-handler.test.mjs
```

Expected: FAIL because generated outputs are not currently compared with the template/source.

**Step 3: Implement post-generation QA**

- Extract lightweight frames/audio evidence from the generated candidate.
- Submit structured source/template/candidate evidence to a text-capable analysis handler.
- Calculate deterministic rule-based caps after model scoring.
- Persist `ViralQualityReport` with the candidate artifact.
- Show dimension scores and missing P0 events in the results node.
- Create a repair proposal, but do not enqueue a paid retry unless the batch recipe explicitly authorizes retries and budget remains.

**Step 4: Run focused tests**

```bash
cd web
npx -y tsx --test tests/viral-video-quality.test.mjs
cd ../gateway
npx tsx --test tests/viral-quality-handler.test.mjs
```

Expected: PASS; a visually attractive but incomplete candidate cannot report ≥90.

**Step 5: Commit**

```bash
git add web/src/lib/canvas/viral-video-quality.ts web/src/components/canvas/viral-video-results-node-content.tsx web/tests/viral-video-quality.test.mjs gateway/src/canvas-job-handlers/viral-quality.ts gateway/src/index.ts gateway/src/types.ts gateway/tests/viral-quality-handler.test.mjs
git commit -m "feat: score viral remake fidelity after generation"
```

## Task 14: Add spend preflight, authorization, and duplicate-charge protection

**Files:**

- Create: `web/src/lib/canvas/viral-video-cost-preflight.ts`
- Modify: `web/src/components/canvas/viral-video-batch-node-content.tsx`
- Modify: `gateway/src/viral-batch-routes.ts`
- Modify: `gateway/src/viral-batch-coordinator.ts`
- Test: `web/tests/viral-video-cost-preflight.test.mjs`
- Test: `gateway/tests/viral-batch-idempotency.test.mjs`

**Step 1: Write the failing tests**

Verify preflight includes:

- requested complete candidate count;
- estimated per-candidate duration and route;
- estimated analysis/image/video/QA costs;
- retry ceiling, which defaults to zero;
- maximum authorized total;
- an immutable submission hash.

Verify double-clicking or retrying the same HTTP request creates one batch. Verify a batch cannot schedule work whose estimated maximum exceeds the authorization snapshot.

**Step 2: Run the tests and verify they fail**

```bash
cd web
npx -y tsx --test tests/viral-video-cost-preflight.test.mjs
cd ../gateway
npx tsx --test tests/viral-batch-idempotency.test.mjs
```

Expected: FAIL because current submission safety is job-level and does not protect a large batch budget.

**Step 3: Implement spend safety**

- Calculate an explainable estimate before enabling submit.
- Require confirmation of exact count and maximum authorized spend.
- Sign/hash the template revision, batch recipe, model route, count, and retry policy.
- Reject duplicate submission keys, stale revisions, count changes, or server-side estimates above the authorization ceiling.
- Default retry count and automatic expansion to zero.

**Step 4: Run focused tests**

```bash
cd web
npx -y tsx --test tests/viral-video-cost-preflight.test.mjs
cd ../gateway
npx tsx --test tests/viral-batch-idempotency.test.mjs
```

Expected: PASS; one logical click can authorize only one bounded batch.

**Step 5: Commit**

```bash
git add web/src/lib/canvas/viral-video-cost-preflight.ts web/src/components/canvas/viral-video-batch-node-content.tsx web/tests/viral-video-cost-preflight.test.mjs gateway/src/viral-batch-routes.ts gateway/src/viral-batch-coordinator.ts gateway/tests/viral-batch-idempotency.test.mjs
git commit -m "feat: protect viral remake batch spend"
```

## Task 15: Complete regression coverage, documentation, and a no-cost release rehearsal

**Files:**

- Modify: `docs/content/docs/progress/todo.mdx`
- Modify: `docs/content/docs/progress/pending-test.mdx`
- Modify: `CHANGELOG.md`
- Modify: `AGENTS.md`
- Create: `docs/content/docs/canvas/viral-remake-workflow.mdx`
- Modify: `docs/content/docs/canvas/meta.json`
- Create or modify: end-to-end mocked workflow tests under `web/tests/` and `gateway/tests/`

**Step 1: Add the end-to-end regression before final wiring**

Build a deterministic mocked path covering:

```text
reference video
→ source recognition
→ uploaded phone-case recognition
→ automatic binding
→ one master template
→ P0 coverage gate
→ 1000-manifest dry compile
→ durable mocked batch
→ results pagination
→ quality scoring
```

Assert no paid provider is invoked in this rehearsal.

**Step 2: Run the regression and verify any remaining failure**

```bash
cd web
npx -y tsx --test tests/viral-remake-e2e.test.mjs
cd ../gateway
npx tsx --test tests/viral-remake-e2e.test.mjs
```

Expected before final wiring: at least one integration assertion fails, identifying the remaining boundary mismatch.

**Step 3: Finish wiring and update documentation**

- Document the five-card user flow and the distinction between template events, replacement bindings, variable slots, and complete candidates.
- Document model capability routing and duration behavior.
- Document batch lifecycle, pause/resume/cancel, retry authorization, storage, pagination, and reconciliation.
- Record exactly which checks remain manual and which require paid provider authorization.
- Update TODO, pending tests, changelog, and contributor guidance to match actual behavior.

**Step 4: Run the full release verification**

From `web/`:

```bash
npm run typecheck
npm run build
npx -y tsx --test tests/*.test.mjs
```

From `gateway/`:

```bash
npm test
npm run build
```

Then perform a browser rehearsal with mocked provider responses:

- upload/choose a reference video;
- inspect recognized objects and event frames;
- add zero, one, and multiple optional replacement assets;
- correct one ambiguous binding;
- inspect the complete template and duration diagnostics;
- compile 1 and 1000 candidates;
- submit only the mocked batch;
- pause, reload, resume, cancel;
- browse results and QA reports;
- verify no duplicate submission and no paid provider call.

**Step 5: Commit**

```bash
git add docs/content/docs/progress/todo.mdx docs/content/docs/progress/pending-test.mdx CHANGELOG.md AGENTS.md docs/content/docs/canvas/viral-remake-workflow.mdx docs/content/docs/canvas/meta.json web/tests/viral-remake-e2e.test.mjs gateway/tests/viral-remake-e2e.test.mjs
git commit -m "docs: finalize viral remake workflow rollout"
```

## Milestone C gate and real-output acceptance

The software release gate is the complete no-cost rehearsal above. Real video calls remain a separately authorized validation activity.

When the user explicitly authorizes a real-output test, use the supplied reference clip and replacement product to run an initial candidate count chosen by the user. For the proposed 10-run benchmark, require all of the following:

- source duration is detected from the actual file (approximately 23.625 seconds for the supplied reference), not hard-coded to 15 seconds;
- P0 events include the opening blast/opening, product avalanche, presenter emergence, product demonstration, and CTA;
- the green/gray/white wardrobe sequence is retained where it matters;
- all 10 outputs contain every P0 event;
- at least 8 of 10 receive a total fidelity score of 90 or above;
- identity/product continuity and audio/subtitle intent are separately reviewable;
- a failed pilot pauses expansion and produces diagnostics; it never automatically starts a larger batch.

## Implementation discipline

- Use `@test-driven-development` for each behavior change.
- Use `@systematic-debugging` when a regression or visual mismatch appears; do not patch prompts blindly.
- Use `@frontend-design` for Task 11 while keeping the established GouYingAI canvas visual language.
- Use `@verification-before-completion` before claiming any milestone is finished.
- Preserve unrelated user changes in the dirty worktree. Stage and commit only the files listed for the active task.
- Never place API keys, access tokens, generated media blobs, or signed URLs in fixtures, logs, docs, or commits.

## Definition of done

The feature is done only when a user can provide one reference video, optionally provide any combination of product/person/scene/prop images without describing them, confirm only ambiguous automatic bindings, inspect one complete fidelity-gated master template, choose any candidate count from 1 to 1000, see exact preflight scope/cost, submit a durable resumable batch, and review paginated outputs with evidence-backed fidelity scores—without the system silently deleting source events, inventing plan-level variants, duplicating charges, or creating hundreds of canvas cards.
