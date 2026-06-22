import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeChatMessage, normalizeDisplayName, normalizeRoomId } from "../src/validation/sanitize.js";

test("normalizes display names", () => {
  assert.deepEqual(normalizeDisplayName(" Алекс ").ok, true);
  assert.equal(normalizeDisplayName("").ok, false);
  assert.equal(normalizeDisplayName("<script>").ok, false);
  assert.equal(normalizeDisplayName("a".repeat(31)).ok, false);
});

test("normalizes room ids", () => {
  assert.equal(normalizeRoomId("abcd_123").ok, true);
  assert.equal(normalizeRoomId("../bad").ok, false);
  assert.equal(normalizeRoomId("abc").ok, false);
});

test("normalizes chat messages", () => {
  assert.deepEqual(normalizeChatMessage(" hello ").value, "hello");
  assert.equal(normalizeChatMessage("   ").ok, false);
  assert.equal(normalizeChatMessage("a".repeat(1001)).ok, false);
});
