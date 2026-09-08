# AutoDL ComfyUI Video Adapter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a secure, generic AutoDL ComfyUI video provider to GouYingAI, with `minimax_h3_lightx2v_v5` as the first multi-image workflow and immediate preservation of temporary result videos.

**Architecture:** Keep the browser and canvas on the existing OpenAI-style `/v1/videos` contract. Add one isolated gateway adapter that converts the unified multipart request into a model-configured AutoDL workflow JSON body, normalizes async task states, and proxies the short-lived result through `/v1/videos/:id/content`. AutoDL-specific behavior is selected only by the channel `api_format`; existing OpenAI, Gemini, Omni, and Seedance paths remain untouched.

**Tech Stack:** Node.js 20, TypeScript, Express 5, native Fetch/FormData/File APIs, React 19, Ant Design 6, local JSON gateway store, Supabase PostgreSQL.

---

## Working rules

- Follow `AGENTS.md`: minimal changes, no unrelated refactors, no fallback to another model/channel, and no credentials in source or logs.
- The current worktree contains user changes. Stage only files listed by the current task; never reset or clean the worktree.
- Do not place the AutoDL Token in this plan, source files, browser configuration, test fixtures, or shell history. The user enters it through the admin channel form after implementation.
- The repository instruction says the user runs builds/tests. The commands below are the exact verification commands; during implementation, write the tests but do not execute build/typecheck/test unless the user explicitly asks again.
- The exact `minimax_h3_lightx2v_v5` Request Body is still required before the final runtime configuration step. Do not guess the reference-image field or encode a paid test submission.

### Task 1: Define and test the AutoDL adapter contract

**Files:**
- Create: `gateway/src/autodl-comfyui.ts`
- Create: `gateway/tests/autodl-comfyui.test.mjs`

**Step 1: Write failing pure adapter tests**

Cover these behaviors without network calls:

```js
test("resolves typed AutoDL request template values", async () => {
  const options = {
    autodl: {
      workflowId: "minimax_h3_lightx2v_v5",
      requestTemplate: {
        prompt: "{{prompt}}",
        images: "{{referenceImages}}",
        duration: "{{duration}}",
        resolution: "{{resolution}}",
      },
      durationMap: { "15": 15 },
      resolutionMap: { "768": "768p竖" },
      minReferenceImages: 1,
      maxReferenceImages: 5,
    },
  };
  const request = buildAutoDlWorkflowRequest(options, {
    prompt: "keep the ring shape stable",
    duration: "15",
    resolution: "768",
    referenceImages: ["data:image/png;base64,AAA", "https://cdn.test/person.png"],
  });
  assert.equal(request.workflowId, "minimax_h3_lightx2v_v5");
  assert.equal(request.body.duration, 15);
  assert.equal(request.body.resolution, "768p竖");
  assert.deepEqual(request.body.images, ["data:image/png;base64,AAA", "https://cdn.test/person.png"]);
});

test("rejects missing prompt, references above the configured limit, and unmapped values", () => {
  assert.throws(() => buildAutoDlWorkflowRequest(options, { prompt: "", duration: "15", resolution: "768", referenceImages: [] }), /提示词/);
  assert.throws(() => buildAutoDlWorkflowRequest(options, { prompt: "x", duration: "15", resolution: "768", referenceImages: sixImages }), /参考图最多/);
  assert.throws(() => buildAutoDlWorkflowRequest(options, { prompt: "x", duration: "99", resolution: "768", referenceImages: [] }), /时长/);
});

test("normalizes AutoDL task states and finds the first video result", () => {
  assert.deepEqual(normalizeAutoDlTask({ data: { task_id: "a", status: "QUEUED", results: [] } }), { upstreamTaskId: "a", status: "queued" });
  assert.equal(normalizeAutoDlTask({ data: { task_id: "a", status: "SUCCESS", results: [{ url: "https://cdn.test/out.mp4" }] } }).resultUrl, "https://cdn.test/out.mp4");
  assert.equal(normalizeAutoDlTask({ data: { task_id: "a", status: "FAILED", message: "bad input" } }).error, "bad input");
});
```

Also test that an exact placeholder preserves arrays/numbers/booleans and that embedded text placeholders remain strings.

**Step 2: Verification command (expected to fail before implementation)**

Run when authorized:

```powershell
npm --prefix gateway test -- --test-name-pattern AutoDL
```

Expected: FAIL because `gateway/src/autodl-comfyui.ts` does not exist.

**Step 3: Implement one cohesive adapter module**

Export only the small surface used by both gateway runtimes:

```ts
export type AutoDlVideoInput = {
    prompt: string;
    duration: string;
    resolution: string;
    referenceImages: string[];
};

export type AutoDlNormalizedTask = {
    upstreamTaskId?: string;
    status: "queued" | "in_progress" | "completed" | "failed";
    resultUrl?: string;
    error?: string;
};

export function buildAutoDlWorkflowRequest(options: Record<string, unknown>, input: AutoDlVideoInput): { workflowId: string; body: Record<string, unknown> };
export function normalizeAutoDlTask(payload: unknown): AutoDlNormalizedTask;
export async function parseUnifiedVideoInput(raw: Buffer, contentType: string): Promise<{ model: string } & AutoDlVideoInput>;
export function autoDlCreateUrl(baseUrl: string, workflowId: string): string;
export function autoDlResultUrl(baseUrl: string, taskId: string): string;
```

Implementation constraints:

- Validate `options.autodl.workflowId`, `requestTemplate`, `durationMap`, `resolutionMap`, `minReferenceImages`, and `maxReferenceImages` with short type guards; do not add a schema framework for one config object.
- Parse the existing multipart request using Node 20 `Request.formData()`. Read `model`, `prompt`, `seconds`, `resolution_name`, and repeated `reference_images` entries. Convert `File` entries to Data URLs while preserving already-string URLs/Data URLs.
- For JSON requests, read the same logical values from the parsed object.
- Resolve template placeholders recursively. If the whole string equals `{{referenceImages}}`, return the actual array; if it equals `{{duration}}`, return the mapped number/string unchanged.
- Reject missing/unknown template placeholders instead of silently omitting them.
- Parse AutoDL envelopes from `data.task_id`, `data.status`, `data.results`, `data.message`, top-level `msg`, and `message`.
- Recognize result strings and object fields `url`, `video_url`, `result_url`; do not recursively scan arbitrary objects.
- Never include headers or Token values in thrown errors.

**Step 4: Verification command (expected to pass after implementation)**

Run when authorized:

```powershell
npm --prefix gateway test -- --test-name-pattern AutoDL
```

Expected: all adapter contract tests PASS.

**Step 5: Commit only adapter files**

```powershell
git add prolab/gateway/src/autodl-comfyui.ts prolab/gateway/tests/autodl-comfyui.test.mjs
git commit -m "feat(gateway): add AutoDL ComfyUI adapter contract"
```

### Task 2: Add AutoDL as an explicit gateway API format

**Files:**
- Modify: `gateway/src/types.ts:1-21`
- Modify: `gateway/src/local-store.ts:52-66`
- Modify: `web/src/services/gateway-admin.ts:6-70`
- Modify: `supabase/supabase/migrations/0002_gouyingai_model_gateway.sql:29-64`

**Step 1: Extend the shared format type**

Introduce one reusable union in `gateway/src/types.ts`:

```ts
export type ApiFormat = "openai" | "gemini" | "autodl_comfyui";
```

Use `ApiFormat` for `Channel.api_format` and `Model.api_format`, and import it in `LocalStore.createChannel` instead of repeating the union.

Mirror the same union in the web gateway service:

```ts
export type GatewayApiFormat = "openai" | "gemini" | "autodl_comfyui";
```

Use it for channel/model types and create/update inputs.

**Step 2: Update the not-yet-live schema directly**

Per `AGENTS.md`, this project is not live and does not require a compatibility migration. Change both `api_format` constraints in `0002_gouyingai_model_gateway.sql` to:

```sql
check (api_format in ('openai', 'gemini', 'autodl_comfyui'))
```

Do not add task columns: channel ID and model ID already let polling recover the adapter and workflow options after restart.

**Step 3: Static review**

Run when authorized:

```powershell
npm --prefix gateway run build
npm --prefix web run typecheck
```

Expected: no type errors involving `api_format`.

**Step 4: Commit the format/schema change**

```powershell
git add prolab/gateway/src/types.ts prolab/gateway/src/local-store.ts prolab/web/src/services/gateway-admin.ts prolab/supabase/supabase/migrations/0002_gouyingai_model_gateway.sql
git commit -m "feat(gateway): register AutoDL channel format"
```

### Task 3: Route AutoDL submission through the local gateway

**Files:**
- Modify: `gateway/src/local-server.ts:20-115`
- Modify: `gateway/tests/autodl-comfyui.test.mjs`

**Step 1: Write a failing local gateway integration test**

Create an in-process mock AutoDL server and assert:

```js
assert.equal(received.path, "/comfyui_workflow/minimax_h3_lightx2v_v5");
assert.equal(received.authorization, "test-autodl-token");
assert.equal(received.body.prompt, "new cast with stable product");
assert.deepEqual(received.body.images, [expectedDataUrl]);
assert.match(created.id, /^gt-/);
```

The test channel uses `api_format: "autodl_comfyui"`, a fake encrypted token, and model options containing the request template. The mock create response must use the real envelope shape:

```json
{"code":"Success","data":{"task_id":"autodl-task-1","status":"QUEUED"},"msg":""}
```

**Step 2: Add the AutoDL submission branch**

After strict model/capability/channel selection and before generic upstream forwarding:

```ts
if (channel.api_format === "autodl_comfyui" && model.capability === "video" && req.method === "POST" && req.path === "/v1/videos") {
    const input = await parseUnifiedVideoInput(raw, contentType);
    const request = buildAutoDlWorkflowRequest(model.options, input);
    const upstream = await fetch(autoDlCreateUrl(channel.base_url, request.workflowId), {
        method: "POST",
        headers: {
            authorization: decryptSecret(channel.key_ciphertext),
            "content-type": "application/json",
        },
        body: JSON.stringify(request.body),
    });
    // Normalize, require upstreamTaskId, save a gt-* task, and return { id, status }.
}
```

Keep task creation in a short local helper within `local-server.ts`; do not duplicate AutoDL parsing/template logic there. Use the existing `GatewayTask` shape and `store.saveTask`.

Errors must preserve AutoDL's `msg/message` but never echo the request headers, raw Token, or full reference-image data.

**Step 3: Verification command**

Run when authorized:

```powershell
npm --prefix gateway test -- --test-name-pattern "AutoDL.*submit"
```

Expected: the new integration test PASS; existing strict capability-routing tests remain unchanged.

**Step 4: Commit local submission routing**

```powershell
git add prolab/gateway/src/local-server.ts prolab/gateway/tests/autodl-comfyui.test.mjs
git commit -m "feat(gateway): submit AutoDL video workflows"
```

### Task 4: Normalize polling and proxy short-lived video content locally

**Files:**
- Modify: `gateway/src/local-server.ts:26-48`
- Modify: `gateway/tests/autodl-comfyui.test.mjs`

**Step 1: Write failing polling/content tests**

Test the complete sequence:

1. AutoDL query returns `RUNNING`; gateway returns `{ id: localId, status: "in_progress" }`.
2. AutoDL query returns `SUCCESS` with `results: [{ url: temporaryVideoUrl }]`; gateway returns `{ id: localId, status: "completed" }` without exposing the temporary URL.
3. `GET /v1/videos/:id/content` queries the result, fetches the temporary URL immediately, and returns the exact `video/mp4` bytes.
4. `FAILED` maps to `status: "failed"` with the upstream message.
5. `SUCCESS` with no result URL returns a clear failed response rather than an empty success.

**Step 2: Implement one AutoDL task branch before OpenAI polling**

For a stored video task, load both channel and model. When the channel format is AutoDL:

```ts
const stateResponse = await fetch(autoDlResultUrl(channel.base_url, task.upstream_task_id), {
    headers: { authorization: decryptSecret(channel.key_ciphertext) },
});
const state = normalizeAutoDlTask(await stateResponse.json());
```

- Normal poll: return only the local task ID, normalized status, and sanitized error.
- `/content`: require `completed` and `resultUrl`, then fetch the result URL and stream its bytes/content type.
- Do not add AutoDL Authorization to arbitrary third-party result hosts. Signed result URLs should be fetched without credentials.
- Preserve the task record after completion so a refresh can query it again while the upstream URL is valid.

**Step 3: Verification command**

Run when authorized:

```powershell
npm --prefix gateway test -- --test-name-pattern "AutoDL.*poll|AutoDL.*content"
```

Expected: all state and content-proxy tests PASS.

**Step 4: Commit polling/content routing**

```powershell
git add prolab/gateway/src/local-server.ts prolab/gateway/tests/autodl-comfyui.test.mjs
git commit -m "feat(gateway): proxy AutoDL video task results"
```

### Task 5: Apply the same adapter to the authenticated gateway

**Files:**
- Modify: `gateway/src/server.ts:38-139`
- Modify: `gateway/tests/autodl-comfyui.test.mjs`

**Step 1: Extract only reusable request functions, not a framework**

Keep protocol logic in `autodl-comfyui.ts`. In `server.ts`, add the same two small branches as local mode:

- submit after strict model/capability/channel resolution;
- poll/content after loading the stored `GatewayTask`, channel, and model.

Persist tasks through the existing `memoryTasks` plus `gouyingai_gateway_tasks` upsert. Do not create a second task store or modify the browser API.

**Step 2: Add a regression assertion for persisted task recovery**

Use a small fake Supabase client or test the shared adapter boundary: polling must derive `workflowId` from `task.model_id` and the current model options, not from process memory. The acceptance assertion is that a task loaded from storage can still construct the correct AutoDL result URL after gateway restart.

**Step 3: Verification command**

Run when authorized:

```powershell
npm --prefix gateway test
npm --prefix gateway run build
```

Expected: all gateway tests PASS and TypeScript compilation succeeds.

**Step 4: Commit authenticated gateway routing**

```powershell
git add prolab/gateway/src/server.ts prolab/gateway/tests/autodl-comfyui.test.mjs
git commit -m "feat(gateway): support AutoDL in authenticated mode"
```

### Task 6: Expose AutoDL in the existing management console

**Files:**
- Modify: `web/src/pages/admin/index.tsx:10-11,333-375`
- Modify: `web/src/services/gateway-admin.ts:6-70`

**Step 1: Add the explicit format option**

Use the shared web type and add the same option to both channel and model selects:

```ts
{ label: "AutoDL ComfyUI", value: "autodl_comfyui" }
```

Do not build a new settings page. Reuse the existing encrypted channel form and model `options` JSON editor.

**Step 2: Make the model options guidance actionable**

When the selected channel is AutoDL, change the existing help text to show this compact skeleton without any secret:

```json
{
  "autodl": {
    "workflowId": "minimax_h3_lightx2v_v5",
    "requestTemplate": {
      "prompt": "{{prompt}}",
      "<真实多图字段>": "{{referenceImages}}",
      "<真实时长字段>": "{{duration}}",
      "<真实分辨率字段>": "{{resolution}}"
    },
    "durationMap": { "15": "<真实API值>" },
    "resolutionMap": { "768": "<真实API值>" },
    "minReferenceImages": 1,
    "maxReferenceImages": 5
  }
}
```

Keep the existing JSON parse validation. Do not add parallel local channel configuration or an API one-click entry outside the management console.

**Step 3: Verification command**

Run when authorized:

```powershell
npm --prefix web run typecheck
npm --prefix web run build
```

Expected: typecheck/build succeeds; both create/edit forms preserve `autodl_comfyui`.

**Step 4: Commit admin support**

```powershell
git add prolab/web/src/pages/admin/index.tsx prolab/web/src/services/gateway-admin.ts
git commit -m "feat(admin): configure AutoDL ComfyUI channels"
```

### Task 7: Configure the H3 multi-image workflow without exposing credentials

**Files:**
- No tracked source file receives the Token.
- Runtime data only: Gateway encrypted channel store or `gouyingai_channels`/`gouyingai_models` via the management console.

**Step 1: Obtain the exact workflow Request Body**

From AutoDL's `minimax_h3_lightx2v_v5` “在线调用 API / API” panel, copy:

- exact reference-image field name and whether it accepts URL, Data URL, Base64, asset ID, or array;
- duration field name and allowed values;
- resolution/orientation field name and allowed values;
- maximum reference-image count.

No paid request is submitted during discovery.

**Step 2: Create the channel in management console**

- Name: `AutoDL ComfyUI`
- Base URL: `https://autodl.art/api/v1/comfyui`
- Format: `AutoDL ComfyUI`
- API Key: paste the current/rotated Token once; leave it only in encrypted gateway storage.

Because the Token was pasted into chat, recommend rotating it before production use.

**Step 3: Create the model**

- Display name: `MiniMax H3 多图参考生视频`
- Model name: `minimax-h3-autodl-multi-reference`
- Capability: `video`
- Format: `AutoDL ComfyUI`
- Options: the verified workflow template and maps from Step 1.
- Published: enabled.

**Step 4: Confirm catalog selection without generating**

Refresh the Gateway catalog and verify the model appears in video model selection. Do not submit a paid task yet.

### Task 8: Document the change and hand off manual verification

**Files:**
- Modify: `docs/content/docs/progress/todo.mdx`
- Modify: `docs/content/docs/progress/pending-test.mdx`
- Modify: `docs/gouyingai-system-integration.md`

**Step 1: Update project tracking**

- Add AutoDL ComfyUI adapter as completed in TODO.
- Add a pending-test item covering one real H3 multi-reference generation, immediate result preservation, page refresh recovery, failure message, and one-task billing.
- State that reference images are transmitted according to the configured workflow template; do not claim a field name before it is confirmed.

**Step 2: Add integration documentation**

Document:

- admin-only channel/model setup;
- `api_format: autodl_comfyui`;
- workflow template placeholders;
- submit/poll/content normalization;
- raw AutoDL Authorization semantics;
- temporary result URL preservation;
- security rule that the Token never enters frontend source/config.

**Step 3: Final review commands**

Run only when the user explicitly requests verification:

```powershell
npm --prefix gateway test
npm --prefix gateway run build
npm --prefix web run typecheck
npm --prefix web run build
```

Expected:

- gateway tests all PASS;
- gateway TypeScript build succeeds;
- web typecheck and production build succeed;
- no tracked file contains the Token;
- existing OpenAI video task test remains PASS.

Perform a secret scan using only the known token prefix, never printing the full token:

```powershell
rg -l "<仅在本机临时填写的令牌前缀>" gateway web docs supabase
```

Expected: no output.

**Step 4: Commit documentation only**

```powershell
git add prolab/docs/content/docs/progress/todo.mdx prolab/docs/content/docs/progress/pending-test.mdx prolab/docs/gouyingai-system-integration.md
git commit -m "docs: document AutoDL video integration"
```

## Final acceptance checklist

- AutoDL is an explicit provider format, not detected by URL substrings.
- Gateway is the only component that sees the Token.
- Browser keeps the existing `/v1/videos` API and existing `storeGeneratedVideo` persistence behavior.
- `minimax_h3_lightx2v_v5` receives all configured reference images in the exact upstream format.
- One viral-remake creative creates one paid task and one final video node.
- Polling survives page refresh and gateway restart through the persisted local task mapping.
- Successful temporary results are downloaded through the gateway content route immediately.
- Existing video providers are unchanged.
