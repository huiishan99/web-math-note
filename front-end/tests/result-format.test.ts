import * as assert from "node:assert/strict";
import { test } from "node:test";

import {
  getResultLatex,
  getResultText,
  isMathLikeResult,
  shouldUseResultCard,
} from "../src/lib/result-format";
import type { CalculationItem } from "../src/types/calculator";

const baseResult: CalculationItem = {
  id: "result-1",
  expr: "1 + 1",
  result: "2",
  assign: false,
  steps: [],
  position: { x: 10, y: 20 },
};

test("formats a simple answer as an inline equals result", () => {
  assert.equal(getResultText(baseResult), "= 2");
  assert.equal(getResultLatex(baseResult), "\\(\\LARGE{= 2}\\)");
  assert.equal(shouldUseResultCard(baseResult), false);
});

test("uses cards for assignments and explanatory steps", () => {
  assert.equal(shouldUseResultCard({ ...baseResult, assign: true }), true);
  assert.equal(shouldUseResultCard({ ...baseResult, steps: ["Add the values."] }), true);
});

test("keeps prose answers out of math rendering", () => {
  assert.equal(isMathLikeResult("one short sentence"), false);
  assert.equal(isMathLikeResult("x = 4"), true);
  assert.equal(isMathLikeResult("42"), true);
});
