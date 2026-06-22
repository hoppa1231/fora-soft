import assert from "node:assert/strict";
import { test } from "node:test";
import { isValidRoomId, validateDisplayName, validateMessage, validateRoomName } from "./validation.js";

test("validates display names", () => {
  assert.equal(validateDisplayName(" Алекс ").ok, true);
  assert.equal(validateDisplayName("").ok, false);
  assert.equal(validateDisplayName("<script>").ok, false);
  assert.equal(validateDisplayName("a".repeat(31)).ok, false);
});

test("validates room names", () => {
  assert.equal(validateRoomName(" Комната ").ok, true);
  assert.equal(validateRoomName("").ok, false);
  assert.equal(validateRoomName("<script>").ok, false);
  assert.equal(validateRoomName("a".repeat(31)).ok, false);
});

test("validates messages", () => {
  assert.equal(validateMessage("привет").ok, true);
  assert.equal(validateMessage("   ").ok, false);
  assert.equal(validateMessage("a".repeat(1001)).ok, false);
});

test("validates room ids", () => {
  assert.equal(isValidRoomId("abcd_1234"), true);
  assert.equal(isValidRoomId("../bad"), false);
  assert.equal(isValidRoomId("abc"), false);
});
