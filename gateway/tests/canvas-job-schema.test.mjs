import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL("../../supabase/supabase/migrations/0003_gouyingai_canvas_jobs.sql", import.meta.url);

test("canvas jobs persist ownership, revisions, leases, and idempotency", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /create table if not exists public\.gouyingai_canvas_jobs/i);
  for (const column of ["user_id", "canvas_id", "target_node_id", "generation_revision", "client_request_id", "status", "lease_owner", "lease_expires_at", "upstream_task_id", "result_patch"]) {
    assert.match(sql, new RegExp(`\\b${column}\\b`, "i"));
  }
  assert.match(sql, /unique\s*\(user_id,\s*client_request_id\)/i);
  assert.match(sql, /create index[^;]+\(status,\s*queued_at\)/i);
  assert.match(sql, /create index[^;]+\(user_id,\s*canvas_id,\s*updated_at/i);
  assert.match(sql, /claim_gouyingai_canvas_jobs/i);
  assert.match(sql, /for update skip locked/i);
  assert.match(sql, /status\s+in\s*\(\s*'leased'\s*,\s*'submitting'\s*,\s*'running'\s*\)/i);
  assert.match(sql, /alter table public\.gouyingai_canvas_projects\s+add column if not exists revision/i);
  assert.match(sql, /alter table public\.gouyingai_canvas_projects\s+add column if not exists deleted_at/i);
});
