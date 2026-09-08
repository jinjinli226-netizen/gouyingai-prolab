# GouYingAi Brand And Navigation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Fully white-label the runtime Web app as GouYingAi, remove upstream defaults and links, rename persisted compatibility identifiers, and upgrade the desktop navigation.

**Architecture:** Keep routes and API protocols unchanged. Add two static brand assets, make first-run API configuration provider-neutral, remove upstream-facing runtime links, rename local persistence identifiers without migration, and contain navigation behavior inside `AppTopNav` so mobile navigation remains unaffected.

**Tech Stack:** React 19, React Router 7, TypeScript, Tailwind CSS 4, Vite 7, Node test runner.

---

### Task 1: Brand Assets

**Files:**
- Create: `web/public/gouyingai-logo.png`
- Create: `web/public/gouyingai-mark.png`

1. Preserve the supplied 1024px square image as the full brand lockup.
2. Create a compact square derivative containing only the central brand symbol with transparent or tightly cropped background.
3. Inspect both assets and verify that the compact mark remains recognizable at 24px and 32px.

### Task 2: Brand Metadata And Visible Copy

**Files:**
- Modify: `web/index.html`
- Modify: `web/src/components/layout/app-top-nav.tsx`
- Modify: `web/src/pages/home/index.tsx`
- Modify: `web/src/components/canvas/canvas-assistant-panel.tsx`
- Modify: `web/src/components/canvas/canvas-local-agent-panel.tsx`

1. Add a source-level test that scans the Web entry points and fails while the old visible brand remains.
2. Change the browser title, favicon, header brand, homepage copy, assistant label, and user-facing diagnostics to `GouYingAi`.
3. Do not rename storage keys, export format identifiers, package names, API labels, documentation, or license notices.
4. Run the brand source test and confirm it passes.

### Task 3: Provider-Neutral Runtime And Compatibility Identifiers

**Files:**
- Modify: `web/src/stores/use-config-store.ts`
- Modify: `web/src/lib/pro-spec/constants.ts`
- Modify: `web/src/components/onboarding/quick-connect-modal.tsx`
- Modify: `web/src/components/layout/user-status-actions.tsx`
- Modify: `web/src/components/layout/client-root-init.tsx`
- Modify: `web/src/hooks/use-version-check.ts`
- Modify: `web/src/lib/localforage-storage.ts`
- Modify: `web/src/stores/use-asset-store.ts`
- Modify: `web/src/stores/canvas/use-canvas-store.ts`
- Modify: `web/src/stores/use-theme-store.ts`
- Modify: `web/src/services/image-storage.ts`
- Modify: `web/src/services/file-storage.ts`
- Modify: `web/src/services/app-sync.ts`
- Modify: `web/src/pages/image/index.tsx`
- Modify: `web/src/pages/video/index.tsx`
- Modify: `web/src/lib/canvas/canvas-export.ts`
- Modify: `web/src/types/canvas-export.ts`

1. Clear third-party default Base URLs and model presets while retaining an empty configurable channel.
2. Generalize first-run copy from ProAPI to API access and remove provider sign-up promotion.
3. Remove docs, GitHub, remote release, and upstream promotional links from the runtime UI.
4. Rename runtime persistence, export, and sync identifiers from `prolab` to `gouyingai` without migration.
5. Run focused source tests and confirm they pass.

### Task 4: Centered Animated Desktop Navigation

**Files:**
- Modify: `web/src/components/layout/app-top-nav.tsx`
- Test: `web/tests/brand-navigation.test.mjs`

1. Add a failing source-level test for a viewport-centered desktop navigation container and stronger active-state classes.
2. Make the header inner container `relative` and place the desktop navigation at `left-1/2` with horizontal translation.
3. Give navigation items stable dimensions, rounded active backgrounds, stronger text contrast, and an animated bottom accent.
4. Add restrained hover lift/background transitions without changing layout dimensions.
5. Preserve the existing mobile menu button and drawer behavior.
6. Run the focused test and confirm it passes.

### Task 5: Verification

**Files:**
- Verify: `web/tests/brand-navigation.test.mjs`

1. Run `node --test tests/brand-navigation.test.mjs tests/vite-proxy.test.mjs` from `web` and expect all tests to pass.
2. Run `npm run build` from `web` and expect a successful Vite production build.
3. Inspect `http://127.0.0.1:4173/` at desktop and mobile widths.
4. Confirm the compact mark, GouYingAi name, centered navigation, active highlight, hover animation, and mobile layout render without overlap.
