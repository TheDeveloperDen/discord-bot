import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { Bump } from "../../store/models/Bump.js";
import { clearBumpsCache } from "../../store/models/bumps.js";
import { clearUserCache, DDUser } from "../../store/models/DDUser.js";
import { getSequelizeInstance, initStorage } from "../../store/storage.js";
import { getLeaderboardPage, leaderboardFor } from "./leaderboard.js";

beforeAll(async () => {
	await initStorage();
});

afterEach(async () => {
	await getSequelizeInstance().destroyAll();
	clearUserCache();
	clearBumpsCache();
});

async function user(id: number, values: Partial<DDUser> = {}) {
	return DDUser.create({
		id: BigInt(id),
		xp: 0n,
		level: 0,
		bumps: 0,
		currentDailyStreak: 0,
		highestDailyStreak: 0,
		...values,
	});
}

const DAY = 1000 * 60 * 60 * 24;
let nextMessageId = 1n;
async function bump(userId: number, daysAgo = 0) {
	await Bump.create({
		messageId: nextMessageId++,
		userId: BigInt(userId),
		timestamp: new Date(Date.now() - daysAgo * DAY),
	});
}

describe("getLeaderboardPage", () => {
	test("orders by the column, leaves out zeros, and counts the rest", async () => {
		await user(1, { level: 2 });
		await user(2, { level: 9 });
		await user(3, { level: 0 });
		await user(4, { level: 5 });

		const page = await getLeaderboardPage(leaderboardFor("level"), {
			offset: 0,
			limit: 10,
		});

		expect(page).toEqual({
			items: [
				{ userId: "2", count: 9 },
				{ userId: "4", count: 5 },
				{ userId: "1", count: 2 },
			],
			total: 3,
		});
	});

	// SQLite keeps bigints as text ("50n"), so xp ordering is only checkable on Postgres
	test("xp leaves out users with none", async () => {
		await user(1, { xp: 50n });
		await user(2, { xp: 0n });

		const page = await getLeaderboardPage(leaderboardFor("xp"), {
			offset: 0,
			limit: 10,
		});

		expect(page).toEqual({ items: [{ userId: "1", count: 50 }], total: 1 });
	});

	test("pages with the offset and limit", async () => {
		for (let id = 1; id <= 5; id++) await user(id, { highestDailyStreak: id });

		const page = await getLeaderboardPage(
			leaderboardFor("highestDailyStreak"),
			{
				offset: 2,
				limit: 2,
			},
		);

		expect(page).toEqual({
			items: [
				{ userId: "3", count: 3 },
				{ userId: "2", count: 2 },
			],
			total: 5,
		});
	});

	test("current streaks leave out anyone whose streak has lapsed", async () => {
		await user(1, { currentDailyStreak: 4, lastDailyTime: new Date() });
		await user(2, {
			currentDailyStreak: 9,
			lastDailyTime: new Date(Date.now() - 3 * DAY),
		});

		const page = await getLeaderboardPage(
			leaderboardFor("currentDailyStreak"),
			{
				offset: 0,
				limit: 10,
			},
		);

		expect(page).toEqual({ items: [{ userId: "1", count: 4 }], total: 1 });
	});

	test("all-time bumps add the historical count to the recorded bumps", async () => {
		await user(1, { bumps: 2 });
		await user(2);
		await bump(2);
		await bump(2, 30);
		await bump(2, 60);
		await user(3);

		const page = await getLeaderboardPage(leaderboardFor("bumps"), {
			offset: 0,
			limit: 10,
		});

		expect(page).toEqual({
			items: [
				{ userId: "2", count: 3 },
				{ userId: "1", count: 2 },
			],
			total: 2,
		});
	});

	test("a bumps page past the end still counts everyone", async () => {
		await user(1, { bumps: 2 });
		await user(2);
		await bump(2);

		const page = await getLeaderboardPage(leaderboardFor("bumps"), {
			offset: 10,
			limit: 10,
		});

		expect(page).toEqual({ items: [], total: 2 });
	});

	test("weekly bumps only count the last 7 days", async () => {
		await user(1, { bumps: 10 });
		await bump(1, 30);
		await user(2);
		await bump(2, 1);
		await bump(2, 2);
		await user(3);
		await bump(3, 3);

		const page = await getLeaderboardPage(leaderboardFor("weeklyBumps"), {
			offset: 1,
			limit: 10,
		});

		expect(page).toEqual({
			items: [{ userId: "3", count: 1 }],
			total: 2,
		});
	});
});
