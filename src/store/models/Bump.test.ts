import { expect, test } from "bun:test";
import { extractStreaks, getStreak, getStreaks } from "./bumps.js";

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

import * as bumps from "./bumpData.json" with { type: "json" };

test("getStreak with real data", () => {
	const streaks = extractStreaks(
		bumps.default.map((b) => ({
			...b,
			userId: BigInt(b.userId),
		})),
	).toReversed();

	expect(streaks.length).toBeGreaterThan(0);
	expect(streaks[0]).toBeArrayOfSize(2);
	expect(streaks[1]).toBeArrayOfSize(1);
	expect(streaks[2]).toBeArrayOfSize(2);
	expect(streaks[3]).toBeArrayOfSize(8);

	const actualStreaks = getStreak(1118501031488274517n, streaks);
	expect(actualStreaks).toEqual({
		current: 8,
		highest: 8,
	});
});

test("getStreaks with real data", () => {
	const streaks = extractStreaks(
		bumps.default.map((b) => ({
			...b,
			userId: BigInt(b.userId),
		})),
	).toReversed();

	const actualStreaks = getStreaks(streaks);
	expect(actualStreaks).toBeArrayOfSize(4);
	expect(actualStreaks[0]).toEqual({
		userId: 266973575225933824n,
		current: 2,
		highest: 2,
	});
	expect(actualStreaks[1]).toEqual({
		userId: 245994206965792780n,
		current: 1,
		highest: 1,
	});
	expect(actualStreaks[2]).toEqual({
		userId: 266973575225933824n,
		current: 2,
		highest: 2,
	});
	expect(actualStreaks[3]).toEqual({
		userId: 1118501031488274517n,
		current: 8,
		highest: 8,
	});
});
