import { strict as assert } from "node:assert";
import { test } from "node:test";
import { VerificationAttempts } from "../src/lib/verification-attempt";

test("a late prior widget callback cannot settle the retry", async () => {
  const attempts = new VerificationAttempts();
  const first = attempts.begin();
  const firstRejected = assert.rejects(first.promise, /timed out/);
  assert.equal(attempts.settle(first.id, undefined, "timed out"), true);
  await firstRejected;
  const retry = attempts.begin();
  assert.equal(attempts.settle(first.id, "stale-token"), false);
  assert.equal(attempts.settle(first.id, undefined, "stale error"), false);
  assert.equal(attempts.isCurrent(retry.id), true);
  assert.equal(attempts.settle(retry.id, "fresh-token"), true);
  assert.equal(await retry.promise, "fresh-token");
});

test("duplicate clicks cannot create parallel verification attempts", async () => {
  const attempts = new VerificationAttempts();
  const first = attempts.begin();
  assert.throws(() => attempts.begin(), /already running/);
  attempts.settle(first.id, "token");
  await first.promise;
});

test("unmount cancellation rejects pending work", async () => {
  const attempts = new VerificationAttempts();
  const first = attempts.begin();
  const cancelled = assert.rejects(first.promise, /cancelled/);
  attempts.cancel();
  await cancelled;
  assert.equal(attempts.isCurrent(first.id), false);
});
