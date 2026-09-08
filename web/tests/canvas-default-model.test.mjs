import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createServer } from "vite";

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "silent",
});
after(() => server.close());

const { normalizeRequestedModelOption } = await server.ssrLoadModule("/src/stores/use-config-store.ts");
const defaultModel = "gouyingai-platform::gpt-image-2";
const config = {
  channels: [
    {
      id: "gouyingai-platform",
      name: "GouYingAi 平台模型",
      baseUrl: "http://127.0.0.1:8788",
      apiKey: "",
      apiFormat: "openai",
      models: ["gpt-image-2"],
    },
  ],
};

test("a blank model captured before catalog hydration falls back to the loaded default", () => {
  assert.equal(normalizeRequestedModelOption(config, "", defaultModel), defaultModel);
  assert.equal(normalizeRequestedModelOption(config, "   ", defaultModel), defaultModel);
});

test("a nonblank invalid model remains explicit so the UI can report it", () => {
  assert.equal(normalizeRequestedModelOption(config, "deleted::gpt-image-2", defaultModel), "deleted::gpt-image-2");
});
