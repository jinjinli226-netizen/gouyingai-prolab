import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const { createLocalGatewayApp } = await import("../src/local-server.ts");
const { encryptSecret } = await import("../src/encryption.ts");
const { LocalStore } = await import("../src/local-store.ts");

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

function serverUrl(server) {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}`;
}

test("local model catalog is never cached by browsers", async (t) => {
  const storeDirectory = mkdtempSync(join(tmpdir(), "gouyingai-catalog-cache-test-"));
  const store = new LocalStore(join(storeDirectory, "store.json"));
  const gateway = createLocalGatewayApp(store).listen(0, "127.0.0.1");
  await new Promise((resolve) => gateway.once("listening", resolve));
  t.after(async () => {
    await close(gateway);
    rmSync(storeDirectory, { recursive: true, force: true });
  });

  const response = await fetch(`${serverUrl(gateway)}/v1/models`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("local gateway fails closed on missing or mismatched model capability", async (t) => {
  process.env.GATEWAY_ENCRYPTION_KEY = "a".repeat(64);
  let forwardedCount = 0;
  let forwardedCapability;
  let forwardedAuthorization;
  const upstream = createServer((req, res) => {
    forwardedCount += 1;
    forwardedCapability = req.headers["x-gouyingai-capability"];
    forwardedAuthorization = req.headers.authorization;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true }));
  });
  await listen(upstream);

  const storeDirectory = mkdtempSync(join(tmpdir(), "gouyingai-gateway-test-"));
  const store = new LocalStore(join(storeDirectory, "store.json"));
  const channel = store.createChannel({
    name: "Text upstream",
    base_url: serverUrl(upstream),
    api_format: "openai",
    key_ciphertext: encryptSecret("upstream-key"),
    enabled: true,
  });
  store.createModel({
    channel_id: channel.id,
    model_name: "gemini-3.6-flash",
    display_name: "Gemini Flash",
    capability: "text",
    api_format: "openai",
    published: true,
    sort_order: 0,
    options: {},
  });
  const gateway = createLocalGatewayApp(store).listen(0, "127.0.0.1");
  await new Promise((resolve) => gateway.once("listening", resolve));
  t.after(async () => {
    await close(gateway);
    await close(upstream);
    rmSync(storeDirectory, { recursive: true, force: true });
  });

  const endpoint = `${serverUrl(gateway)}/v1/responses`;
  const request = (capability) =>
    fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(capability ? { "x-gouyingai-capability": capability } : {}),
      },
      body: JSON.stringify({ model: "gemini-3.6-flash", input: "hello" }),
    });

  assert.equal((await request()).status, 400);
  assert.equal((await request("image")).status, 409);
  assert.equal(forwardedCount, 0);

  assert.equal((await request("text")).status, 200);
  assert.equal(forwardedCount, 1);
  assert.equal(forwardedCapability, undefined);
  assert.equal(forwardedAuthorization, "Bearer upstream-key");
});

test("local gateway translates OpenAI video chat into native Gemini inlineData", async (t) => {
  process.env.GATEWAY_ENCRYPTION_KEY = "a".repeat(64);
  let upstreamPath = "";
  let upstreamKey = "";
  let upstreamBody;
  const upstream = createServer((req, res) => {
    upstreamPath = req.url || "";
    upstreamKey = String(req.headers["x-goog-api-key"] || "");
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      upstreamBody = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: "native video understood" }] } }] }));
    });
  });
  await listen(upstream);

  const storeDirectory = mkdtempSync(join(tmpdir(), "gouyingai-gemini-video-test-"));
  const store = new LocalStore(join(storeDirectory, "store.json"));
  const channel = store.createChannel({
    name: "Gemini native",
    base_url: serverUrl(upstream),
    api_format: "gemini",
    key_ciphertext: encryptSecret("gemini-key"),
    enabled: true,
  });
  store.createModel({
    channel_id: channel.id,
    model_name: "gemini-3.7-flash-high",
    display_name: "Gemini 3.7 Flash High",
    capability: "text",
    api_format: "gemini",
    published: true,
    sort_order: 0,
    options: {},
  });
  const gateway = createLocalGatewayApp(store).listen(0, "127.0.0.1");
  await new Promise((resolve) => gateway.once("listening", resolve));
  t.after(async () => {
    await close(gateway);
    await close(upstream);
    rmSync(storeDirectory, { recursive: true, force: true });
  });

  const response = await fetch(`${serverUrl(gateway)}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-gouyingai-capability": "text" },
    body: JSON.stringify({
      model: "gemini-3.7-flash-high",
      stream: true,
      messages: [{ role: "user", content: [{ type: "text", text: "analyze" }, { type: "video_url", video_url: { url: "data:video/mp4;base64,AAAA" } }] }],
    }),
  });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).choices[0].message.content, "native video understood");
  assert.equal(upstreamPath, "/v1beta/models/gemini-3.7-flash-high:generateContent");
  assert.equal(upstreamKey, "gemini-key");
  assert.deepEqual(upstreamBody.contents[0].parts, [
    { text: "analyze" },
    { inlineData: { mimeType: "video/mp4", data: "AAAA" } },
  ]);
});

test("local gateway registers OpenAI video tasks when the upstream returns id", async (t) => {
  process.env.GATEWAY_ENCRYPTION_KEY = "a".repeat(64);
  const upstreamPaths = [];
  const upstream = createServer((req, res) => {
    upstreamPaths.push(req.url);
    res.setHeader("content-type", "application/json");
    if (req.method === "POST") return void res.end(JSON.stringify({ id: "upstream-h3-task", status: "queued" }));
    res.end(JSON.stringify({ id: "upstream-h3-task", status: "in_progress" }));
  });
  await listen(upstream);

  const storeDirectory = mkdtempSync(join(tmpdir(), "gouyingai-video-task-test-"));
  const store = new LocalStore(join(storeDirectory, "store.json"));
  const channel = store.createChannel({
    name: "MiniMax H3",
    base_url: serverUrl(upstream),
    api_format: "openai",
    key_ciphertext: encryptSecret("upstream-key"),
    enabled: true,
  });
  store.createModel({
    channel_id: channel.id,
    model_name: "minimax-h3-2k",
    display_name: "MiniMax H3 2K",
    capability: "video",
    api_format: "openai",
    published: true,
    sort_order: 0,
    options: {},
  });
  const gateway = createLocalGatewayApp(store).listen(0, "127.0.0.1");
  await new Promise((resolve) => gateway.once("listening", resolve));
  t.after(async () => {
    await close(gateway);
    await close(upstream);
    rmSync(storeDirectory, { recursive: true, force: true });
  });

  const createdResponse = await fetch(`${serverUrl(gateway)}/v1/videos`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-gouyingai-capability": "video" },
    body: JSON.stringify({ model: "minimax-h3-2k", prompt: "test" }),
  });
  assert.equal(createdResponse.status, 200);
  const created = await createdResponse.json();
  assert.match(created.id, /^gt-/);
  assert.notEqual(created.id, "upstream-h3-task");

  const pollResponse = await fetch(`${serverUrl(gateway)}/v1/videos/${created.id}`);
  assert.equal(pollResponse.status, 200);
  assert.equal((await pollResponse.json()).status, "in_progress");
  assert.deepEqual(upstreamPaths, ["/v1/videos", "/v1/videos/upstream-h3-task"]);
});
