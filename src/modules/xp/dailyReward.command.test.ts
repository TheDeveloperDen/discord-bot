import { describe, expect, test } from "bun:test";
import type { DDUser } from "../../store/models/DDUser.js";
import {
	formatDayCount,
	getActualDailyStreakWithoutSaving,
	getNextDailyTime,
	getNextDailyTimeFrom,
} from "./dailyReward.command.js";

describe("formatDayCount", () => {
	test("returns '1 day' for count of 1", () => {
		expect(formatDayCount(1)).toBe("1 day");
	});

	test("returns 'N days' for count > 1", () => {
		expect(formatDayCount(2)).toBe("2 days");
		expect(formatDayCount(10)).toBe("10 days");
		expect(formatDayCount(100)).toBe("100 days");
	});

	test("returns '0 days' for count of 0", () => {
		expect(formatDayCount(0)).toBe("0 days");
	});
});

describe("getActualDailyStreakWithoutSaving", () => {
	const createMockDDUser = (
		overrides?: Partial<{
			currentDailyStreak: number;
			lastDailyTime: Date | null;
		}>,
	): DDUser => {
		return {
			currentDailyStreak: overrides?.currentDailyStreak ?? 5,
			lastDailyTime:
				"lastDailyTime" in (overrides ?? {})
					? overrides?.lastDailyTime
					: new Date(),
		} as DDUser;
	};

	test("returns current streak when within 48 hours", () => {
		const user = createMockDDUser({
			currentDailyStreak: 5,
			lastDailyTime: new Date(Date.now() - 1000 * 60 * 60 * 24), // 24 hours ago
		});

		const [reset, streak] = getActualDailyStreakWithoutSaving(user);

		expect(reset).toBe(false);
		expect(streak).toBe(5);
	});

	test("resets streak to 0 when over 48 hours", () => {
		const user = createMockDDUser({
			currentDailyStreak: 10,
			lastDailyTime: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
		});

		const [reset, streak] = getActualDailyStreakWithoutSaving(user);

		expect(reset).toBe(true);
		expect(streak).toBe(0);
		expect(user.currentDailyStreak).toBe(0); // Mutates the user object
	});

	test("resets streak when exactly at 48 hours", () => {
		const user = createMockDDUser({
			currentDailyStreak: 7,
			lastDailyTime: new Date(Date.now() - 1000 * 60 * 60 * 48), // Exactly 48 hours ago
		});

		const [reset, streak] = getActualDailyStreakWithoutSaving(user);

		expect(reset).toBe(true);
		expect(streak).toBe(0);
	});

	test("handles null lastDailyTime as reset needed", () => {
		const user = createMockDDUser({
			currentDailyStreak: 5,
			lastDailyTime: null,
		});

		const [reset, streak] = getActualDailyStreakWithoutSaving(user);

		// When lastDailyTime is null, difference is Date.now() - 0 which is > 48 hours
		expect(reset).toBe(true);
		expect(streak).toBe(0);
	});

	test("returns streak when 47 hours have passed", () => {
		const user = createMockDDUser({
			currentDailyStreak: 3,
			lastDailyTime: new Date(Date.now() - 1000 * 60 * 60 * 47), // 47 hours ago
		});

		const [reset, streak] = getActualDailyStreakWithoutSaving(user);

		expect(reset).toBe(false);
		expect(streak).toBe(3);
	});
});

describe("getNextDailyTime", () => {
	test("returns undefined when lastDailyTime is null", () => {
		const user = {
			lastDailyTime: null,
		} as DDUser;

		const result = getNextDailyTime(user);

		expect(result).toBeUndefined();
	});

	test("returns date 24 hours after lastDailyTime", () => {
		const lastClaim = new Date("2024-01-15T10:30:00Z");
		const user = {
			lastDailyTime: lastClaim,
		} as DDUser;

		const result = getNextDailyTime(user);

		expect(result).toBeDefined();
		expect(result?.getTime()).toBe(
			lastClaim.getTime() + 1000 * 60 * 60 * 24,
		);
	});
});

describe("getNextDailyTimeFrom", () => {
	test("adds exactly 24 hours to the date", () => {
		const baseDate = new Date("2024-01-15T12:00:00Z");

		const result = getNextDailyTimeFrom(baseDate);

		expect(result.getTime()).toBe(baseDate.getTime() + 1000 * 60 * 60 * 24);
	});

	test("preserves time of day", () => {
		const baseDate = new Date("2024-01-15T14:30:45Z");

		const result = getNextDailyTimeFrom(baseDate);

		expect(result.getUTCHours()).toBe(14);
		expect(result.getUTCMinutes()).toBe(30);
		expect(result.getUTCSeconds()).toBe(45);
	});

	test("handles month boundaries", () => {
		const baseDate = new Date("2024-01-31T12:00:00Z");

		const result = getNextDailyTimeFrom(baseDate);

		expect(result.getUTCMonth()).toBe(1); // February (0-indexed)
		expect(result.getUTCDate()).toBe(1);
	});

	test("handles year boundaries", () => {
		const baseDate = new Date("2024-12-31T23:00:00Z");

		const result = getNextDailyTimeFrom(baseDate);

		expect(result.getUTCFullYear()).toBe(2025);
		expect(result.getUTCMonth()).toBe(0); // January
		expect(result.getUTCDate()).toBe(1);
	});
});
