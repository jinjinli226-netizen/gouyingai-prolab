# Durable Canvas Generation Jobs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make every canvas generation task server-owned, durable across refresh/browser shutdown, isolated by canvas, and safely reconciled back to the correct node.

**Architecture:** Add a persistent job repository and worker in Gateway, backed by Supabase in production and LocalStore in local mode. The browser uploads durable inputs, submits idempotent jobs, stores only job identity on nodes, and reconciles server result patches by canvas/node generation revision. Deliver durable video first because it fixes the reported refresh interruption, then migrate text/image/audio and multi-stage workflows onto the same kernel.

**Tech Stack:** Node 20, TypeScript, Express 5, Supabase/Postgres/Storage, Vite, React 19, Zustand, localForage, Node test runner, `tsx --test`.

---

## Constraints

- Follow `docs/superpowers/specs/2026-08-26-durable-canvas-generation-jobs-design.md`.
- Preserve strict model/capability/channel routing. Never reroute a queued task to another model.
- Do not persist API keys, signed URLs, Base64 media, or complete upstream responses in job rows.
- Do not add a front-end submission limit. Gateway settings own concurrency.
- Keep existing user changes. Commit steps are conditional on a configured Git identity.
- Use TDD for every production behavior: write a focused failing test, verify RED, implement minimally, verify GREEN.

## Milestone A: Durable job kernel and reported video recovery

### Task 1: Add the persistent job schema and atomic claim function

**Files:**

- Create: `supabase/supabase/migrations/0003_gouyingai_canvas_jobs.sql`
- Test: `gateway/tests/canvas-job-schema.test.mjs`

**Step 1: Write the failing schema contract test**

Read the migration as text and assert it defines:

- `gouyingai_canvas_jobs` with ownership, canvas/node identity, generation revision, idempotency, state, lease, upstream ID, result and error columns.
- unique `(user_id, client_request_id)`.
- indexes for queue and per-canvas lookup.
- a `claim_gouyingai_canvas_jobs` security-definer function using `for update skip locked`.
- `revision` and `deleted_at` on `gouyingai_canvas_projects`.

**Step 2: Run RED**

Run: `node --test tests/canvas-job-schema.test.mjs` from `gateway/`.

Expected: FAIL because migration `0003` does not exist.

**Step 3: Add the migration**

Use explicit status checks, foreign keys and timestamps. Gateway service role is the only writer; enable RLS without public policies on job rows. The claim function must atomically change eligible `queued` or expired `leased` rows to `leased`, set `lease_owner`, `lease_expires_at`, `heartbeat_at`, and return the claimed rows.

**Step 4: Run GREEN**

Run: `node --test tests/canvas-job-schema.test.mjs`.

Expected: PASS.

### Task 2: Define the job domain and repository contract

**Files:**

- Modify: `gateway/src/types.ts`
- Create: `gateway/src/canvas-jobs.ts`
- Test: `gateway/tests/canvas-jobs.test.mjs`

**Step 1: Write failing domain tests**

Cover:

- legal state transitions;
- terminal states cannot return to running;
- `clientRequestId` deduplication;
- result patch identity requires `canvasId`, `nodeId`, `jobId`, `generationRevision`;
- public job serialization excludes `input`, leases and upstream internals.

**Step 2: Run RED**

Run: `npm test -- --test-name-pattern="canvas job"` from `gateway/`.

Expected: FAIL because the domain functions do not exist.

**Step 3: Implement minimal job types and pure functions**

Define `CanvasJobKind`, `CanvasJobStatus`, `CanvasJob`, `CanvasJobCreateInput`, `CanvasJobResultPatch`, `CanvasJobRepository`, `canTransitionCanvasJob`, and `toPublicCanvasJob`.

**Step 4: Run GREEN**

Run the same command and expect all canvas job domain tests to pass.

### Task 3: Persist jobs in LocalStore with crash-safe writes

**Files:**

- Modify: `gateway/src/local-store.ts`
- Modify: `gateway/src/types.ts`
- Test: `gateway/tests/local-canvas-jobs.test.mjs`

**Step 1: Write failing repository tests**

Use a temporary directory and verify:

- jobs survive a new `LocalStore` instance;
- duplicate `(userId, clientRequestId)` returns the original job;
- listing filters by user and canvas;
- atomic claim respects configured limit and lease;
- expired lease is reclaimable;
- another user's task is never returned;
- file output remains valid JSON after each update.

**Step 2: Run RED**

Run: `node --test tests/local-canvas-jobs.test.mjs`.

Expected: FAIL because LocalStore lacks canvas job operations.

**Step 3: Implement minimal local repository**

Extend `LocalStoreData` with `canvasJobs` and `gatewaySettings`. Replace direct final-file writes with temp-file write plus atomic rename. Add create/get/list/update/claim methods using `user_id` ownership.

**Step 4: Run GREEN**

Run the test and expect PASS.

### Task 4: Add Supabase and local job API routes with ownership enforcement

**Files:**

- Create: `gateway/src/canvas-job-routes.ts`
- Modify: `gateway/src/server.ts`
- Modify: `gateway/src/local-server.ts`
- Test: `gateway/tests/canvas-job-routes.test.mjs`
- Modify: `gateway/tests/capability-routing.test.mjs`

**Step 1: Write failing API tests**

Cover:

- `POST /v1/canvas-jobs` is idempotent;
- `GET /v1/canvas-jobs` only lists current-user tasks;
- `GET /v1/canvas-jobs/:id`, cancel and retry reject another user;
- existing `/v1/videos/:id` and `/content` return 404 for a task owned by another user;
- local mode consistently uses owner `local`.

**Step 2: Run RED**

Run: `npm test -- --test-name-pattern="canvas job|video task ownership"` from `gateway/`.

Expected: FAIL on missing routes and missing existing-video ownership check.

**Step 3: Implement routes**

Register routes before the `/v1/*` proxy. Validate body size and required identifiers. Use `res.locals.user.id` in production and the local owner in local mode. Add `task.user_id === currentUserId` checks to legacy video polling/content.

**Step 4: Run GREEN**

Run the targeted Gateway tests and expect PASS.

### Task 5: Add the lease-based worker and backend concurrency settings

**Files:**

- Create: `gateway/src/canvas-job-runner.ts`
- Create: `gateway/src/canvas-job-settings.ts`
- Modify: `gateway/src/index.ts`
- Modify: `gateway/src/local-index.ts` or the actual local startup entry found during implementation
- Test: `gateway/tests/canvas-job-runner.test.mjs`

**Step 1: Write failing runner tests**

Use a fake repository and fake handler to verify:

- configured global limit is respected;
- capability/channel limits are respected;
- jobs from multiple canvases are selected fairly;
- heartbeat renews leases;
- expired jobs with `upstream_task_id` resume polling without resubmission;
- runner shutdown stops claiming without cancelling already submitted upstream jobs.

**Step 2: Run RED**

Run: `node --test tests/canvas-job-runner.test.mjs`.

Expected: FAIL because the runner is absent.

**Step 3: Implement the runner**

Use repository claims as the sole source of work. Keep in-memory promises only as execution handles, never as task truth. Load concurrency from Gateway settings with environment fallbacks.

**Step 4: Run GREEN**

Run the runner tests and expect PASS.

### Task 6: Make video generation a durable Gateway job

**Files:**

- Create: `gateway/src/canvas-job-handlers/video-job-handler.ts`
- Modify: `gateway/src/canvas-job-runner.ts`
- Modify: `gateway/src/server.ts`
- Modify: `gateway/src/local-server.ts`
- Test: `gateway/tests/canvas-video-job.test.mjs`

**Step 1: Write failing video recovery tests**

Verify:

- a queued video job stores the selected model/channel and submits exactly once;
- returned upstream task ID is persisted before polling;
- a new runner instance resumes polling an existing upstream task;
- success stores durable result metadata;
- unknown submit outcome does not automatically retry;
- result from an old generation revision is retained but marked unmounted.

**Step 2: Run RED**

Run: `node --test tests/canvas-video-job.test.mjs`.

Expected: FAIL because the handler is absent.

**Step 3: Implement the video handler**

Reuse existing strict routing and AutoDL/OpenAI polling adapters. Split submit from poll so `upstream_task_id` is persisted immediately. Keep current direct `/v1/videos` compatibility while canvas starts using jobs.

**Step 4: Run GREEN**

Run the video job tests and existing `autodl-comfyui`/`capability-routing` tests.

### Task 7: Add front-end job API and durable node metadata

**Files:**

- Create: `web/src/services/api/canvas-jobs.ts`
- Create: `web/src/types/canvas-job.ts`
- Modify: `web/src/types/canvas.ts`
- Test: `web/tests/canvas-job-client.test.mjs`

**Step 1: Write failing client contract tests**

Assert request/response normalization and node metadata fields:

- `generationJobId`;
- `generationRevision`;
- `generationStatus`;
- no API key or Base64 input in the persisted job reference.

**Step 2: Run RED**

Run: `node --test tests/canvas-job-client.test.mjs` from `web/`.

Expected: FAIL because client and metadata do not exist.

**Step 3: Implement minimal API functions and types**

Add create/list/get/cancel/retry functions using the existing authenticated request layer.

**Step 4: Run GREEN**

Run the test and expect PASS.

### Task 8: Reconcile video nodes instead of resetting them on refresh

**Files:**

- Create: `web/src/lib/canvas/canvas-job-reconciliation.ts`
- Modify: `web/src/pages/canvas/project.tsx`
- Modify: `web/src/services/api/video.ts`
- Test: `web/tests/canvas-job-reconciliation.test.mjs`

**Step 1: Write failing reconciliation tests**

Cover:

- loading node with `generationJobId` remains recoverable after refresh;
- queued/running status updates the same node;
- succeeded result applies only when canvas/node/job/revision all match;
- duplicate result events are no-ops;
- older revision cannot overwrite newer generation;
- legacy loading node without job ID keeps the explicit legacy interruption error.

**Step 2: Run RED**

Run: `node --test tests/canvas-job-reconciliation.test.mjs`.

Expected: FAIL because reconciliation does not exist and current reset marks every loading node as error.

**Step 3: Implement reconciliation and video submission**

Replace the canvas video branch with job creation. Preallocate the output node, increment generation revision, persist the job ID returned by Gateway, and reconcile on project load, focus and a bounded polling interval. Do not abort the server job on component unmount.

**Step 4: Run GREEN**

Run reconciliation tests and relevant existing video generation tests.

**Step 5: Manual reported-symptom check**

Submit a video in a test canvas, capture the returned job ID, refresh while queued/running, and verify the node does not show “页面刷新后生成已中断”. Complete the fake/upstream task and verify the result appears on the original node.

## Milestone B: Durable media and remaining capabilities

### Task 9: Add private artifact upload and durable result storage

**Files:**

- Create: `gateway/src/canvas-artifacts.ts`
- Create: `gateway/src/canvas-artifact-routes.ts`
- Modify: `gateway/src/server.ts`
- Modify: `gateway/src/local-store.ts`
- Create: `web/src/services/api/canvas-artifacts.ts`
- Test: `gateway/tests/canvas-artifacts.test.mjs`
- Test: `web/tests/canvas-artifacts.test.mjs`

**Steps:**

1. Write failing ownership, size, MIME, checksum and path tests.
2. Run tests and verify RED.
3. Implement signed Supabase uploads and local Gateway file storage under user/canvas/job paths.
4. Implement browser Blob upload from existing image/media storage keys.
5. Run tests and verify GREEN.

### Task 10: Add text, image and audio job handlers

**Files:**

- Create: `gateway/src/canvas-job-handlers/text-job-handler.ts`
- Create: `gateway/src/canvas-job-handlers/image-job-handler.ts`
- Create: `gateway/src/canvas-job-handlers/audio-job-handler.ts`
- Modify: `gateway/src/canvas-job-runner.ts`
- Test: `gateway/tests/canvas-capability-jobs.test.mjs`

**Steps:**

1. Write failing handler tests for strict routing, durable output and safe retry boundaries.
2. Run RED.
3. Extract/reuse existing Gateway upstream request logic behind normalized job handlers.
4. Copy image/audio outputs to durable storage before success.
5. Run handler tests plus Gateway routing tests and verify GREEN.

### Task 11: Route generic canvas generation through jobs

**Files:**

- Modify: `web/src/pages/canvas/project.tsx`
- Modify: `web/src/services/api/image.ts`
- Modify: `web/src/services/api/audio.ts`
- Test: `web/tests/canvas-all-capability-jobs.test.mjs`

**Steps:**

1. Write failing source/behavior tests proving canvas branches create jobs instead of awaiting model calls.
2. Run RED.
3. Migrate text/image/audio branches using the same preallocated node and reconciliation flow as video.
4. Run new tests plus existing image/video/audio routing tests and verify GREEN.

## Milestone C: Per-canvas persistence, cross-tab safety and task center

### Task 12: Split browser persistence into per-canvas records

**Files:**

- Create: `web/src/lib/canvas/canvas-project-storage.ts`
- Modify: `web/src/stores/canvas/use-canvas-store.ts`
- Test: `web/tests/canvas-project-storage.test.mjs`

**Steps:**

1. Write failing tests for independent canvas records, index updates, revision conflicts and legacy import.
2. Run RED.
3. Implement per-canvas IndexedDB keys plus a lightweight index.
4. Add `BroadcastChannel` invalidation that triggers reread rather than copying stale state.
5. Run GREEN.

### Task 13: Add server canvas revisions and idempotent result patches

**Files:**

- Create: `gateway/src/canvas-project-routes.ts`
- Modify: `gateway/src/server.ts`
- Modify: `gateway/src/local-server.ts`
- Create: `web/src/services/api/canvas-projects.ts`
- Test: `gateway/tests/canvas-project-revisions.test.mjs`
- Test: `web/tests/canvas-project-sync.test.mjs`

**Steps:**

1. Write failing expected-revision and result-patch tests.
2. Run RED.
3. Implement server snapshots, soft delete, conflict responses and job-owned patch application.
4. Implement browser merge by node/job/revision.
5. Run GREEN.

### Task 14: Add the global task center

**Files:**

- Create: `web/src/stores/canvas/use-canvas-job-store.ts`
- Create: `web/src/components/canvas/canvas-job-center.tsx`
- Modify: `web/src/layouts/user-layout.tsx`
- Modify: `web/src/pages/canvas/project.tsx`
- Test: `web/tests/canvas-job-center.test.mjs`

**Steps:**

1. Write failing store and UI source-contract tests for all statuses, canvas navigation, cancel, retry and unmounted outputs.
2. Run RED.
3. Implement list reconciliation, bounded polling with focus/network refresh, and optional SSE enhancement.
4. Render a global task-center entry and canvas/node focus navigation.
5. Run tests and visually verify light/dark themes.

## Milestone D: Background workflow migration

### Task 15: Model parent/child workflow jobs

**Files:**

- Modify: `gateway/src/canvas-jobs.ts`
- Modify: `gateway/src/canvas-job-runner.ts`
- Test: `gateway/tests/canvas-workflow-jobs.test.mjs`

**Steps:**

1. Write failing dependency, partial-success, cancellation and parent-summary tests.
2. Run RED.
3. Implement child dependencies and parent aggregation without a second queue system.
4. Run GREEN.

### Task 16: Migrate ecommerce, jewelry and poster batches

**Files:**

- Modify: `web/src/pages/canvas/project.tsx`
- Create or modify focused workflow builders under `web/src/lib/canvas/`
- Test: `web/tests/canvas-background-workflows.test.mjs`

**Steps:**

1. Write failing tests proving each batch submits a parent job with stable child node IDs.
2. Run RED.
3. Move execution to Gateway child jobs while retaining existing prompt and layout builders.
4. Run all workflow tests and verify GREEN.

### Task 17: Migrate viral remake analysis, planning and video generation

**Files:**

- Modify: `web/src/pages/canvas/project.tsx`
- Modify: `web/src/lib/canvas/viral-video-remake-workflow.ts`
- Create: `gateway/src/canvas-job-handlers/viral-workflow-handler.ts`
- Test: `gateway/tests/viral-background-workflow.test.mjs`
- Modify: `web/tests/viral-video-generation.test.mjs`

**Steps:**

1. Write failing tests for the phase DAG, one paid video task per creative, restart recovery and partial failures.
2. Run RED.
3. Submit uploaded source/product artifacts and immutable prompt/analysis snapshots.
4. Execute analysis, plans and single full-video child jobs on Gateway.
5. Remove page-change/unmount cancellation for server-owned runs.
6. Run all viral tests and verify GREEN.

## Milestone E: Admin settings, hardening and documentation

### Task 18: Expose backend scheduler settings in admin

**Files:**

- Modify: `gateway/src/admin.ts`
- Modify: `gateway/src/local-store.ts`
- Locate and modify the existing admin model/settings page under `web/src/pages/admin/`
- Test: `gateway/tests/canvas-job-settings.test.mjs`
- Test: `web/tests/canvas-job-settings.test.mjs`

**Steps:**

1. Write failing validation and admin-authorization tests.
2. Run RED.
3. Implement global/capability/channel concurrency, lease, timeout, retention, storage quota and CORS settings.
4. Run GREEN and visually verify the admin form.

### Task 19: Restrict CORS and add retention cleanup

**Files:**

- Modify: `gateway/src/server.ts`
- Modify: `gateway/src/local-server.ts`
- Create: `gateway/src/canvas-job-cleanup.ts`
- Test: `gateway/tests/canvas-job-hardening.test.mjs`

**Steps:**

1. Write failing allowed-origin, artifact ownership and retention tests.
2. Run RED.
3. Implement configured production origins and cleanup of expired events/orphan intermediates while retaining referenced outputs.
4. Run GREEN.

### Task 20: Update project documentation and run final verification

**Files:**

- Modify: `docs/content/docs/backend/canvas-data-structure.mdx`
- Modify: `docs/content/docs/progress/todo.mdx`
- Modify: `docs/content/docs/progress/pending-test.mdx`
- Modify: `docs/gouyingai-system-integration.md`
- Modify: `CHANGELOG.md`

**Steps:**

1. Document the server job source of truth, local/remote shutdown boundary, APIs, statuses and admin settings.
2. Move completed work to pending test with exact manual scenarios.
3. Run Gateway full tests: `npm test` from `gateway/`.
4. Run Web relevant Node tests, including every new `canvas-*job*.test.mjs` and existing viral/video tests.
5. Run Gateway build: `npm run build` from `gateway/`.
6. Run Web typecheck/build if the existing `@vitejs/plugin-react` declaration compatibility issue has been resolved; otherwise report that pre-existing blocker separately.
7. Manually verify refresh, browser close/reopen, two canvases, two tabs, runner restart, stale result and ownership denial.

## Execution order and checkpoints

- Checkpoint 1 after Task 8: the screenshot's durable video refresh failure is fixed end to end.
- Checkpoint 2 after Task 11: all four single-node capabilities are durable.
- Checkpoint 3 after Task 14: per-canvas persistence and global task center are live.
- Checkpoint 4 after Task 17: all existing batch and viral workflows are background jobs.
- Checkpoint 5 after Task 20: admin controls, hardening and documentation are complete.

At each checkpoint, do not claim completion without fresh automated evidence and the listed manual recovery scenario.
