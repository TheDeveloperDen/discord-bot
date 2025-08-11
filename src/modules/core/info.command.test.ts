import { describe, it, expect } from "bun:test";
import { format } from "./info.command.js";

describe("formatting works", () => {
  it("should format a simple string", () => {
    const input = "Hello, world!";
    const result = format(input);
    expect(result).toBe("`Hello, world!`");
  });

  it("Should format a small number", () => {
    const input = 42;
    const result = format(input);
    expect(result).toBe("`42`");
  });

  it("Should format a small bigint", () => {
    const input = 123n;
    const result = format(input);
    expect(result).toBe("`123`");
  });

  it("Should format a large number with commas", () => {
    const input = 1234567890;
    const result = format(input);
    expect(result).toBe("`1,234,567,890`");
  });

  it("Should format a large bigint with commas", () => {
    const input = 12345678901234567890n;
    const result = format(input);
    expect(result).toBe("`12,345,678,901,234,567,890`");
  });

  it("should format the xp count", () => {
    const input = 25620759n;
    const result = format(input);
    expect(result).toBe("`25,620,759`");
  });
});
