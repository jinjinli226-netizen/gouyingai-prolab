import assert from "node:assert/strict";
import test from "node:test";

const catalog = await import("../src/catalog.ts");
const encryption = await import("../src/encryption.ts");

test("builds upstream URLs for common OpenAI-compatible roots", () => {
    assert.equal(catalog.buildUpstreamUrl("https://api.example.com", "/chat/completions"), "https://api.example.com/v1/chat/completions");
    assert.equal(catalog.buildUpstreamUrl("https://api.example.com/v1", "chat/completions"), "https://api.example.com/v1/chat/completions");
    assert.equal(catalog.buildUpstreamUrl("https://ark.example.com/api/plan/v3", "/contents/generations/tasks"), "https://ark.example.com/api/plan/v3/contents/generations/tasks");
});

test("picks only published models and enabled channels", () => {
    const models = [
        { id: "m1", channel_id: "c1", model_name: "omni-fast", published: true },
        { id: "m2", channel_id: "c2", model_name: "hidden", published: false },
    ];
    assert.equal(catalog.pickModelByName(models, "omni-fast")?.id, "m1");
    assert.equal(catalog.pickModelByName(models, "hidden"), undefined);

    const channels = [{ id: "c1", enabled: true }, { id: "c3", enabled: false }];
    assert.equal(catalog.pickChannelById(channels, "c1")?.id, "c1");
    assert.equal(catalog.pickChannelById(channels, "c3"), undefined);
});

test("does not choose the first model when a published name is ambiguous", () => {
    const models = [
        { id: "m1", channel_id: "c1", model_name: "same-name", published: true },
        { id: "m2", channel_id: "c2", model_name: "same-name", published: true },
    ];
    assert.equal(catalog.pickModelByName(models, "same-name"), undefined);
    assert.deepEqual(catalog.unambiguousPublishedModels(models), []);
});

test("normalizes and validates the capability header", () => {
    assert.equal(catalog.parseModelCapability("text"), "text");
    assert.equal(catalog.parseModelCapability("IMAGE"), "image");
    assert.equal(catalog.parseModelCapability("unknown"), undefined);
    assert.equal(catalog.parseModelCapability(""), undefined);
});

test("extracts model names from JSON and multipart bodies", () => {
    assert.equal(catalog.extractModelNameFromJson(JSON.stringify({ model: "gpt-5", prompt: "x" })), "gpt-5");
    assert.equal(catalog.extractModelNameFromJson(JSON.stringify({ model_name: "omni-fast" })), "omni-fast");
    const multipart = Buffer.from('--x\r\nContent-Disposition: form-data; name="model"\r\n\r\nomni-fast\r\n--x--');
    assert.equal(catalog.extractModelNameFromMultipart(multipart), "omni-fast");
});

test("encrypts and decrypts channel keys with the gateway key", () => {
    process.env.GATEWAY_ENCRYPTION_KEY = "a".repeat(64);
    const encrypted = encryption.encryptSecret("sk-test-1234");
    assert.equal(encryption.isEncryptedSecret(encrypted), true);
    assert.equal(encryption.decryptSecret(encrypted), "sk-test-1234");
    assert.match(encryption.maskSecret(encrypted), /\*\*\*\*1234$/);
});
