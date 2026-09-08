# AutoDL MiniMax H3 Canvas Routing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Publish every AutoDL MiniMax H3 video workflow and make the infinite canvas resolve the exact workflow from connected media, explicit ambiguous modes, duration, and resolution before creating one paid task.

**Architecture:** Keep workflow request schemas in gateway model `options`, expose those options through the existing public catalog, and add a small pure frontend router that converts the catalog-backed auto selector into one concrete model. Extend the generic AutoDL adapter with audio inputs and aspect-aware resolution mapping; the gateway never performs fallback routing.

**Tech Stack:** TypeScript, React, Zustand, Express, Node test runner, Bun test runner, AutoDL ComfyUI async API.

---

### Task 1: Extend the generic AutoDL request contract

**Files:**
- Modify: `gateway/src/autodl-comfyui.ts`
- Modify: `gateway/tests/autodl-comfyui.test.mjs`

**Steps:**
1. Add `size` and `referenceAudios` to `AutoDlVideoInput`.
2. Parse multipart/JSON `reference_audios` without changing existing image fields.
3. Add `minReferenceAudios`, `maxReferenceAudios`, `promptRequired`, `referenceAudio0..2`, and aspect-aware resolution lookup to the template context.
4. Add tests for indexed audio fields, first/last templates, optional prompt, audio limits, and composite resolution keys.
5. Do not submit a real AutoDL task.

### Task 2: Preserve catalog routing metadata and implement a pure router

**Files:**
- Modify: `web/src/stores/use-config-store.ts`
- Create: `web/src/lib/canvas/autodl-h3-video-routing.ts`
- Create: `web/tests/autodl-h3-video-routing.test.mjs`

**Steps:**
1. Preserve each public model's `displayName` and `options` in an in-memory catalog map during `applyServerModels`.
2. Export read-only helpers for a selected model's catalog metadata.
3. Implement strict resolution for `auto`, `multi-reference`, `first-last`, `multi-reference-audio`, `lip-sync`, and `text` routes.
4. Prefer the smallest valid `maxDuration`, which keeps 1–10 second jobs on the standard workflow and selects the 15-second workflow for 11–15 seconds.
5. Reject reference videos, ambiguous/missing catalog routes, invalid counts, and invalid explicit modes before request creation.

### Task 3: Send audio inputs and resolve canvas video models

**Files:**
- Modify: `web/src/services/api/video.ts`
- Modify: `web/src/pages/canvas/project.tsx`

**Steps:**
1. Append resolved audio URL/Base64 values as `reference_audios` for AutoDL H3 requests.
2. Build the node generation context before the readiness check for video mode.
3. When the selected model is the catalog auto selector, resolve and replace `model`/`videoModel` with the concrete model.
4. Save the concrete model on the output node and show the selected display name before the network request.
5. Keep manual concrete-model selection strict and unchanged.

### Task 4: Add the ambiguous-input mode control

**Files:**
- Modify: `web/src/stores/use-config-store.ts`
- Modify: `web/src/types/canvas.ts`
- Modify: `web/src/components/video-settings-panel.tsx`
- Modify: `web/src/components/canvas/canvas-node-prompt-panel.tsx`
- Modify: `web/src/components/canvas/canvas-config-node-panel.tsx`
- Modify: `web/src/pages/canvas/project.tsx`

**Steps:**
1. Add persisted `videoInputMode` with values `auto`, `first-last`, and `lip-sync`.
2. Add an H3-only “素材方式” control to the existing video settings panel.
3. Store per-node overrides in `CanvasNodeMetadata` and map panel changes to metadata.
4. Keep `auto` as default and do not infer first/last or lip-sync from counts alone.

### Task 5: Publish all H3 workflows in the local management backend

**Files:**
- Modify through local admin API: `gateway/data/local-store.json`
- Modify: `web/src/pages/admin/index.tsx`

**Steps:**
1. Update the existing multi-reference and no-picture entries to their verified official limits.
2. Create the auto selector plus concrete entries for standard/15-second multi-reference, first/last, standard/15-second multi-image-audio, lip-sync, and text-to-video.
3. Store exact official field templates, reference limits, duration maps, orientation-aware resolution maps, and `canvasVideoRoute` metadata.
4. Keep the existing encrypted channel token untouched.
5. Set the auto selector first in sort order so it becomes the default H3 canvas entry.

### Task 6: Update operator documentation

**Files:**
- Modify: `docs/gouyingai-system-integration.md`
- Modify: `docs/content/docs/progress/pending-test.mdx`
- Modify: `docs/content/docs/progress/todo.mdx`

**Steps:**
1. Document the seven workflows, node-to-workflow table, manual override behavior, and no-fallback rule.
2. Record audio, first/last, 15-second, and automatic-routing work in pending test.
3. Update the AutoDL todo item without claiming paid generation has been verified.
4. Hand off exact local test commands without running paid API calls.

