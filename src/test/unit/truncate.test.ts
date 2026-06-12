import * as assert from "node:assert/strict";
import { clampNumber, truncateText } from "../../truncate";

suite("truncate", () => {
  test("returns unchanged text within the limit", () => {
    assert.deepEqual(truncateText("abc", 3), {
      text: "abc",
      truncated: false,
      totalChars: 3
    });
  });

  test("truncates by unicode code point", () => {
    assert.deepEqual(truncateText("a😀b", 2), {
      text: "a😀",
      truncated: true,
      totalChars: 3
    });
  });

  test("clamps non-finite and out-of-range values", () => {
    assert.equal(clampNumber(undefined, 10, 1, 20), 10);
    assert.equal(clampNumber(0, 10, 1, 20), 1);
    assert.equal(clampNumber(30, 10, 1, 20), 20);
    assert.equal(clampNumber(12.8, 10, 1, 20), 12);
  });
});
