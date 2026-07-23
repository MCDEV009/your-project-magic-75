import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("example", () => {
  beforeEach(() => {
    // Setup before each test if needed
  });

  afterEach(() => {
    // Cleanup after each test if needed
  });

  it("should pass", () => {
    expect(true).toBe(true);
  });

  it("should perform basic arithmetic", () => {
    expect(1 + 1).toBe(2);
  });

  it("should handle strings", () => {
    expect("hello".toUpperCase()).toBe("HELLO");
  });
});
