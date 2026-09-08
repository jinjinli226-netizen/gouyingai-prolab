import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { scoreViralCandidateQuality } from "../src/lib/canvas/viral-video-quality.ts";

const perfect = {
  candidateId: "candidate-1",
  eventCoverage: 100,
  timelineFidelity: 100,
  identityConsistency: 100,
  productFidelity: 100,
  audioFidelity: 100,
  visualFidelity: 100,
  missingP0EventIds: [],
  evidence: [{ schemaVersion: 1, id: "frame-1", kind: "frame", startSeconds: 0, description: "首帧", confidence: 1 }],
};

describe("viral candidate quality gate", () => {
  test("uses the fixed 30/20/15/15/10/10 rubric", () => {
    const report = scoreViralCandidateQuality({ ...perfect, eventCoverage: 80, timelineFidelity: 70, identityConsistency: 60, productFidelity: 50, audioFidelity: 40, visualFidelity: 30 });
    assert.equal(report.totalScore, 61.5);
    assert.equal(report.decision, "retry");
  });

  test("a missing P0 event caps the total below pass threshold", () => {
    const report = scoreViralCandidateQuality({ ...perfect, missingP0EventIds: ["explosion"] });
    assert.equal(report.totalScore, 79);
    assert.equal(report.decision, "retry");
    assert.match(report.issues.join(" "), /P0/);
  });

  test("returns evidence and concrete repair advice", () => {
    const report = scoreViralCandidateQuality({ ...perfect, productFidelity: 55 });
    assert.equal(report.evidence.length, 1);
    assert.ok(report.issues.some((issue) => issue.includes("商品")));
  });
});
