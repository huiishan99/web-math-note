import { strict as assert } from "node:assert";
import { test } from "node:test";
import { resolveApiUrl } from "../src/lib/api-config";

test("production calls the backend on its own deployment", () => {
  assert.equal(resolveApiUrl(undefined, false), "/api");
  assert.equal(resolveApiUrl("", false), "/api");
});

test("local development keeps the standalone Python backend", () => {
  assert.equal(resolveApiUrl(undefined, true), "http://127.0.0.1:8900");
});

test("custom backends and relative prefixes do not produce double slashes", () => {
  assert.equal(resolveApiUrl("https://api.example.com/", false), "https://api.example.com");
  assert.equal(resolveApiUrl(" /api/ ", false), "/api");
});
