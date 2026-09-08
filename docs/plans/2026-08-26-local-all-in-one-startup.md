# GouYingAi Local All-in-One Startup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make one local command start both GouYingAi frontend and Gateway, while showing an explicit offline state instead of fake zero channel/model counts.

**Architecture:** A dependency-free Node launcher owns the Vite and Gateway child processes and reuses already-listening ports. The admin page keeps its existing Gateway API, but a small pure status helper distinguishes a successful empty directory from a failed request.

**Tech Stack:** Node.js child processes and TCP sockets, Vite, React, TypeScript, Ant Design, Node test runner.

---

### Task 1: Define the unified local service contract

**Files:**
- Create: `tests/local-startup.test.mjs`
- Create: `scripts/start-local.mjs`
- Create: `package.json`

**Step 1:** Write a failing Node test that imports `localServices` and requires exactly two services: Gateway on 8788 and frontend on 3000, both pointing at existing project-local executables.

**Step 2:** Run `node --test tests/local-startup.test.mjs` and verify it fails because `scripts/start-local.mjs` does not exist.

**Step 3:** Implement the smallest dependency-free launcher: probe ports, spawn only missing services, forward output, terminate owned children together, and expose `npm run dev` at the project root.

**Step 4:** Re-run the test and verify it passes.

### Task 2: Distinguish Gateway offline from an empty directory

**Files:**
- Create: `web/tests/admin-directory-status.test.mjs`
- Create: `web/src/pages/admin/admin-directory-status.ts`
- Modify: `web/src/pages/admin/index.tsx`

**Step 1:** Write a failing test requiring failed loads to produce `--` counts and a visible Gateway connection message, while successful empty loads still produce `0`.

**Step 2:** Run the test from `web` with the existing tsx runner and verify it fails because the helper is missing.

**Step 3:** Implement the pure helper and use it in the admin page. Preserve the error from `load()`, render an Ant Design `Alert` with retry, and only render numeric zero after a successful response.

**Step 4:** Re-run the focused test and verify it passes.

### Task 3: Document and launch the repaired local flow

**Files:**
- Modify: `README.md`
- Modify: `docs/content/docs/progress/pending-test.mdx`
- Inspect: `docs/content/docs/progress/todo.mdx`

**Step 1:** Document `npm run dev` from the project root as the only local startup command.

**Step 2:** Record the all-in-one startup and offline-state behavior in pending test; update TODO only if a matching unfinished item exists.

**Step 3:** Verify the startup and UI tests together.

**Step 4:** Resolve the current Vite process path, stop only that verified workspace process, and start `npm run dev` in a hidden persistent process.

**Step 5:** Verify 3000 and 8788 return HTTP 200, `/admin/channels` returns 4 entries, `/admin/models` returns 11 entries, and the browser page can refresh against the restored Gateway.

Git commits are intentionally omitted because this repository has no configured author identity; do not invent or modify the user's Git identity.
