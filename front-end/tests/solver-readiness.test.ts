import { strict as assert } from "node:assert";
import { test } from "node:test";
import { evaluateSolverReadiness } from "../src/lib/solver-readiness";

test("a missing AI configuration is honestly unavailable", () => {
  const result = evaluateSolverReadiness({ configured: false }, false, false);
  assert.equal(result.state, "unavailable");
  assert.match(result.message!, /isn't connected/);
});
test("public Solve needs both halves of bot protection", () => {
  assert.equal(evaluateSolverReadiness({ configured: true, human_verification_required: true, human_verification_configured: false }, true, false).state, "unavailable");
  assert.equal(evaluateSolverReadiness({ configured: true, human_verification_required: true, human_verification_configured: true }, false, false).state, "unavailable");
  assert.equal(evaluateSolverReadiness({ configured: true, human_verification_required: true, human_verification_configured: true }, true, false).state, "ready");
});
test("local backend without required bot protection stays usable", () => {
  const result = evaluateSolverReadiness({ configured: true, human_verification_required: false }, false, true);
  assert.equal(result.state, "ready");
  assert.equal(result.needsVerification, false);
});
