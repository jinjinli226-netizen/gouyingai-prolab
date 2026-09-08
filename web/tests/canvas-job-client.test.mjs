import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const typesSource = await readFile(new URL("../src/types/canvas-job.ts", import.meta.url), "utf8").catch(() => "");
const canvasSource = await readFile(new URL("../src/types/canvas.ts", import.meta.url), "utf8");
const clientSource = await readFile(new URL("../src/services/api/canvas-jobs.ts", import.meta.url), "utf8").catch(() => "");
const gatewayAdminSource = await readFile(new URL("../src/services/gateway-admin.ts", import.meta.url), "utf8").catch(() => "");

test("canvas nodes persist only durable job identity and status", () => {
  assert.match(canvasSource, /generationJobId\?:\s*string/);
  assert.match(canvasSource, /generationRevision\?:\s*number/);
  assert.match(canvasSource, /generationStatus\?:\s*CanvasJobStatus/);
  assert.match(typesSource, /export type CanvasJobReference/);
  const reference = typesSource.slice(typesSource.indexOf("export type CanvasJobReference"));
  assert.doesNotMatch(reference.slice(0, reference.indexOf("};") + 2), /apiKey|input|base64/i);
});

test("canvas job client exposes create, list, get, cancel and retry contracts", () => {
  assert.match(clientSource, /export async function createCanvasJob/);
  assert.match(clientSource, /export async function listCanvasJobs/);
  assert.match(clientSource, /export async function getCanvasJob/);
  assert.match(clientSource, /export async function cancelCanvasJob/);
  assert.match(clientSource, /export async function retryCanvasJob/);
  assert.match(clientSource, /authorization:\s*`Bearer \$\{token\}`/);
  assert.match(clientSource, /bindingId/);
  assert.match(clientSource, /channelId/);
});

test("canvas route binding always fetches the live Gateway catalog", () => {
  assert.match(gatewayAdminSource, /fetchGatewayCatalog[\s\S]*cache:\s*"no-store"/);
});

test("canvas route binding uses a capability-scoped cache-busted catalog and normalizes persisted model names", () => {
  assert.match(clientSource, /fetchGatewayCatalog\(capability\)/);
  assert.match(clientSource, /modelName\.normalize\("NFKC"\)\.trim\(\)/);
  assert.match(gatewayAdminSource, /capability=.*encodeURIComponent\(capability\)/);
  assert.match(gatewayAdminSource, /cacheBust=.*Date\.now\(\)/);
});
