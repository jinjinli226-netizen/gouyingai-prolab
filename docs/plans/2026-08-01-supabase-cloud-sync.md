# Supabase Cloud Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist GouYingAi user projects, assets, generation history, and media in Supabase so signed-in users can recover data across devices.

**Architecture:** The web app remains local-first. A Supabase client is enabled only when public environment variables are present. Supabase Auth identifies the user; Postgres stores JSON records with owner-only RLS; a private Storage bucket contains images, video, and audio. The sync layer merges timestamped local and remote records, then uploads missing media using a user-scoped object path.

**Tech Stack:** React 19, Zustand, localForage, Supabase Auth, Postgres, Supabase Storage, TypeScript, Node test runner.

---

## ADR: Supabase Cloud Persistence

**Status:** Accepted

Browser IndexedDB cannot provide cross-device recovery or survive all browser storage failures. GouYingAi will use Supabase Auth for identity, Postgres for JSON metadata, and private Storage for media. IndexedDB remains an offline cache. API channels and API keys stay only in the browser and are not sent to Supabase. Row Level Security and Storage policies restrict every record and object to its owner. The app remains usable in local-only mode until Supabase environment variables are configured.

## ADR: Fixed Model Gateway

**Status:** Accepted

For the hosted product, end users must not configure channels or API keys. The operator maintains channels and published models through an admin backend; API keys are encrypted on the server. A separate gateway service authenticates browser requests with the Supabase access token, resolves the requested model to its channel, and proxies the AI call with the server-side key. The web app fetches the published catalog from the gateway and routes every AI request through it when `VITE_GATEWAY_URL` is configured.

### Task 1: Add cloud-sync policy helpers

**Files:**
- Create: `web/src/lib/cloud-sync-utils.ts`
- Create: `web/tests/cloud-sync.test.mjs`

1. Write tests for environment validation, owner-scoped media paths, and timestamp conflict resolution.
2. Run the test and confirm it fails because the helper does not exist.
3. Implement the helper with no Supabase runtime dependency.
4. Run the test and confirm it passes.

### Task 2: Add Supabase client and database migration

**Files:**
- Modify: `web/package.json`
- Create: `web/src/services/supabase-client.ts`
- Create: `supabase/migrations/0001_gouyingai_cloud_sync.sql`
- Create: `web/.env.example`

1. Add the Supabase browser SDK.
2. Create a client that safely disables cloud features when public environment variables are absent.
3. Add owner-only tables, RLS policies, a private media bucket, and storage object policies.
4. Document the required environment variables without placing secrets in source control.

### Task 3: Implement local-first cloud synchronization

**Files:**
- Create: `web/src/services/supabase-sync.ts`
- Modify: `web/src/stores/use-config-store.ts`

1. Synchronize canvas projects, assets, image logs, video logs, and referenced media.
2. Merge per record by `updatedAt` or `createdAt`; never erase a local record merely because it is missing remotely.
3. Apply merged records to local stores and persist downloaded media locally.
4. Keep API channels and API keys outside cloud synchronization.

### Task 4: Add account and cloud-sync controls

**Files:**
- Create: `web/src/components/layout/supabase-cloud-panel.tsx`
- Modify: `web/src/components/layout/app-config-modal.tsx`
- Modify: `web/src/components/layout/client-root-init.tsx`

1. Add email magic-link sign-in, sign-out, sync status, and manual sync controls.
2. Restore the active Supabase session on startup.
3. Keep the app fully usable without a cloud configuration.

### Task 5: Verify and document setup

### Task 5: Build the model gateway

**Files:**
- Create: `gateway/` (Express service, encrypted channel keys, admin CRUD, request proxy)
- Create: `supabase/migrations/0002_gouyingai_model_gateway.sql`
- Create: `web/src/services/gateway-admin.ts`
- Create: `web/src/pages/admin/index.tsx`

1. Store channels, models, admins, usage, and gateway task mappings with owner/admin RLS.
2. Expose `GET /v1/models` and proxy `POST/GET /v1/*` using server-side channel keys.
3. Add an admin page (`/admin`) for email sign-in and channel/model/usage management.
4. Load the published catalog into the config store on sign-in so users never configure models.

### Task 6: Verify and document setup

**Files:**
- Modify: `docs/content/docs/overview/usage-guide.mdx`
- Modify: `web/package.json`

1. Run focused cloud-sync and gateway tests and the production build.
2. Add deployment instructions for the Supabase migration, Auth redirect URL, and Vite environment variables.
3. Manually verify both local-only mode and configured cloud mode.
