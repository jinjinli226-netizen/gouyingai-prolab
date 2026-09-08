import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createViralWorkflowMachine, transitionViralWorkflow } from "../src/lib/canvas/viral-video-state-machine.ts";

describe("viral remake state machine", () => {
  test("supports the complete legal production progression", () => {
    let state = createViralWorkflowMachine();
    for (const event of ["START_RECOGNITION", "RECOGNITION_SUCCEEDED", "START_TEMPLATING", "TEMPLATE_SUCCEEDED", "START_COMPILING", "COMPILE_SUCCEEDED", "SUBMITTED", "PARTIAL", "COMPLETED"]) {
      state = transitionViralWorkflow(state, { type: event });
    }
    assert.equal(state.phase, "completed");
  });

  test("reference changes invalidate every dependent revision", () => {
    const ready = { ...createViralWorkflowMachine(), phase: "template_ready", sourceRevision: 1, recognitionRevision: 1, bindingRevision: 1, templateRevision: 1, recipeRevision: 1, manifestRevision: 1, preflightRevision: 1 };
    const state = transitionViralWorkflow(ready, { type: "REFERENCE_CHANGED" });
    assert.equal(state.phase, "idle");
    assert.equal(state.sourceRevision, 2);
    for (const key of ["recognitionRevision", "bindingRevision", "templateRevision", "recipeRevision", "manifestRevision", "preflightRevision"]) assert.equal(state[key], 0);
  });

  test("upload changes keep source recognition but invalidate binding and downstream compilation", () => {
    const ready = { ...createViralWorkflowMachine(), phase: "template_ready", sourceRevision: 1, recognitionRevision: 1, bindingRevision: 1, templateRevision: 1, recipeRevision: 1, manifestRevision: 1, preflightRevision: 1 };
    const state = transitionViralWorkflow(ready, { type: "UPLOAD_CHANGED" });
    assert.equal(state.phase, "requirements_ready");
    assert.equal(state.recognitionRevision, 1);
    assert.equal(state.bindingRevision, 0);
    assert.equal(state.manifestRevision, 0);
  });

  test("count changes invalidate only manifests and cost preflight", () => {
    const ready = { ...createViralWorkflowMachine(), phase: "ready_to_submit", sourceRevision: 1, recognitionRevision: 1, bindingRevision: 1, templateRevision: 1, recipeRevision: 1, manifestRevision: 1, preflightRevision: 1 };
    const state = transitionViralWorkflow(ready, { type: "COUNT_CHANGED" });
    assert.equal(state.phase, "template_ready");
    assert.equal(state.templateRevision, 1);
    assert.equal(state.manifestRevision, 0);
    assert.equal(state.preflightRevision, 0);
  });

  test("editing a running batch creates a new draft without mutating submitted revision", () => {
    const running = { ...createViralWorkflowMachine(), phase: "running", draftRevision: 4, submittedRevision: 4 };
    const state = transitionViralWorkflow(running, { type: "EDIT_DRAFT" });
    assert.equal(state.phase, "running");
    assert.equal(state.draftRevision, 5);
    assert.equal(state.submittedRevision, 4);
  });

  test("rejects illegal transitions", () => {
    assert.throws(() => transitionViralWorkflow(createViralWorkflowMachine(), { type: "SUBMITTED" }), /非法状态转换/);
  });
});
