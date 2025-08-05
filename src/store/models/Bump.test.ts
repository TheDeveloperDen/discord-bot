import { test, expect, mock } from "bun:test";
import { Bump, getStreak } from "./Bump.js";

test("getStreak", () => {
  const streakData: { userId: bigint }[][] = [
    [{ userId: 1n }, { userId: 1n }],
    [{ userId: 2n }],
    [{ userId: 1n }, { userId: 1n }, { userId: 1n }],
  ];

  expect(getStreak(1n, streakData)).toEqual({
    current: 3,
    highest: 3,
  });

  expect(getStreak(2n, streakData)).toEqual({
    current: 0,
    highest: 1,
  });

  expect(getStreak(3n, streakData)).toEqual({
    current: 0,
    highest: 0,
  });
});
