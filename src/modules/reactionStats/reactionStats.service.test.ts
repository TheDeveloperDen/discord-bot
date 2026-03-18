import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import {
	clearUserCache,
	getOrCreateUserById,
} from "../../store/models/DDUser.js";
import { ReactionStat } from "../../store/models/ReactionStat.js";
import { getSequelizeInstance, initStorage } from "../../store/storage.js";
import {
	formatEmoji,
	getDateCutoff,
	getGlobalStats,
	getTopMessages,
	getUserStats,
	periodLabel,
} from "./reactionStats.service.js";

beforeAll(async () => {
	await initStorage();
});

afterEach(async () => {
	await getSequelizeInstance().destroyAll();
	clearUserCache();
});

// ── Helper ──────────────────────────────────────────────

async function createReaction(
	overrides?: Partial<{
		userId: bigint;
		messageId: bigint;
		messageAuthorId: bigint;
		channelId: bigint;
		emojiName: string;
		emojiId: bigint | null;
		isCustomEmoji: boolean;
		reactedAt: Date;
	}>,
) {
	// Ensure the user exists in DDUser table (foreign key constraint)
	const userId = overrides?.userId ?? 1n;
	const messageAuthorId = overrides?.messageAuthorId ?? 2n;
	await getOrCreateUserById(userId);
	if (userId !== messageAuthorId) {
		await getOrCreateUserById(messageAuthorId);
	}

	return ReactionStat.create({
		userId,
		messageId: overrides?.messageId ?? 100n,
		messageAuthorId,
		channelId: overrides?.channelId ?? 500n,
		emojiName: overrides?.emojiName ?? "👍",
		emojiId: overrides?.emojiId ?? null,
		isCustomEmoji: overrides?.isCustomEmoji ?? false,
		reactedAt: overrides?.reactedAt ?? new Date(),
	});
}

function expectDate(value: Date | null): Date {
	expect(value).not.toBeNull();
	if (value === null) {
		throw new Error("Expected date cutoff to be defined");
	}
	return value;
}

// ── getDateCutoff ───────────────────────────────────────

describe("getDateCutoff", () => {
	test("returns null for 'all'", () => {
		expect(getDateCutoff("all")).toBeNull();
	});

	test("returns a date in the past for 'day'", () => {
		const cutoff = expectDate(getDateCutoff("day"));
		const diff = Date.now() - cutoff.getTime();
		// Should be approximately 24h (allow 1s tolerance)
		expect(diff).toBeGreaterThan(1000 * 60 * 60 * 23);
		expect(diff).toBeLessThan(1000 * 60 * 60 * 25);
	});

	test("returns a date in the past for 'week'", () => {
		const cutoff = expectDate(getDateCutoff("week"));
		const diff = Date.now() - cutoff.getTime();
		expect(diff).toBeGreaterThan(1000 * 60 * 60 * 24 * 6);
		expect(diff).toBeLessThan(1000 * 60 * 60 * 24 * 8);
	});

	test("returns a date in the past for 'month'", () => {
		const cutoff = expectDate(getDateCutoff("month"));
		const diff = Date.now() - cutoff.getTime();
		expect(diff).toBeGreaterThan(1000 * 60 * 60 * 24 * 29);
		expect(diff).toBeLessThan(1000 * 60 * 60 * 24 * 31);
	});

	test("returns a date in the past for 'year'", () => {
		const cutoff = expectDate(getDateCutoff("year"));
		const diff = Date.now() - cutoff.getTime();
		expect(diff).toBeGreaterThan(1000 * 60 * 60 * 24 * 364);
		expect(diff).toBeLessThan(1000 * 60 * 60 * 24 * 366);
	});
});

// ── formatEmoji ─────────────────────────────────────────

describe("formatEmoji", () => {
	test("returns unicode emoji directly", () => {
		expect(formatEmoji("👍", false, null)).toBe("👍");
	});

	test("formats custom emoji with ID", () => {
		expect(formatEmoji("pepe", true, 123456789n)).toBe("<:pepe:123456789>");
	});

	test("returns name if custom but no ID", () => {
		expect(formatEmoji("pepe", true, null)).toBe("pepe");
	});
});

// ── periodLabel ─────────────────────────────────────────

describe("periodLabel", () => {
	test("returns correct labels", () => {
		expect(periodLabel("all")).toBe("All Time");
		expect(periodLabel("day")).toBe("Last 24 Hours");
		expect(periodLabel("week")).toBe("Last 7 Days");
		expect(periodLabel("month")).toBe("Last 30 Days");
		expect(periodLabel("year")).toBe("Last Year");
	});
});

// ── getUserStats ────────────────────────────────────────

describe("getUserStats", () => {
	test("returns zeros when no reactions exist", async () => {
		await getOrCreateUserById(999n);
		const stats = await getUserStats(999n, "all");

		expect(stats.totalReactions).toBe(0);
		expect(stats.uniqueMessagesReacted).toBe(0);
		expect(stats.topEmojis).toHaveLength(0);
	});

	test("counts total reactions for a user", async () => {
		await createReaction({ userId: 10n, messageId: 1n, emojiName: "👍" });
		await createReaction({ userId: 10n, messageId: 2n, emojiName: "❤️" });
		await createReaction({ userId: 10n, messageId: 3n, emojiName: "👍" });

		const stats = await getUserStats(10n, "all");

		expect(stats.totalReactions).toBe(3);
		expect(stats.uniqueMessagesReacted).toBe(3);
	});

	test("returns top emojis sorted by count", async () => {
		await createReaction({ userId: 20n, messageId: 1n, emojiName: "👍" });
		await createReaction({ userId: 20n, messageId: 2n, emojiName: "👍" });
		await createReaction({ userId: 20n, messageId: 3n, emojiName: "👍" });
		await createReaction({ userId: 20n, messageId: 4n, emojiName: "❤️" });
		await createReaction({ userId: 20n, messageId: 5n, emojiName: "🔥" });

		const stats = await getUserStats(20n, "all");

		expect(stats.topEmojis.length).toBeGreaterThanOrEqual(2);
		expect(stats.topEmojis[0].emojiName).toBe("👍");
		expect(stats.topEmojis[0].count).toBe(3);
	});

	test("respects limit for top emojis", async () => {
		for (let i = 0; i < 15; i++) {
			await createReaction({
				userId: 30n,
				messageId: BigInt(100 + i),
				emojiName: `emoji${i}`,
			});
		}

		const stats = await getUserStats(30n, "all", 5);
		expect(stats.topEmojis.length).toBeLessThanOrEqual(5);
	});

	test("filters by time period", async () => {
		const now = new Date();
		const twoWeeksAgo = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 14);

		await createReaction({
			userId: 40n,
			messageId: 1n,
			emojiName: "👍",
			reactedAt: now,
		});
		await createReaction({
			userId: 40n,
			messageId: 2n,
			emojiName: "❤️",
			reactedAt: twoWeeksAgo,
		});

		const weekStats = await getUserStats(40n, "week");
		expect(weekStats.totalReactions).toBe(1);

		const allStats = await getUserStats(40n, "all");
		expect(allStats.totalReactions).toBe(2);
	});

	test("counts unique messages correctly with multiple emojis on same message", async () => {
		await createReaction({ userId: 50n, messageId: 1n, emojiName: "👍" });
		await createReaction({ userId: 50n, messageId: 1n, emojiName: "❤️" });
		await createReaction({ userId: 50n, messageId: 2n, emojiName: "👍" });

		const stats = await getUserStats(50n, "all");
		expect(stats.totalReactions).toBe(3);
		expect(stats.uniqueMessagesReacted).toBe(2);
	});
});

// ── getGlobalStats ──────────────────────────────────────

describe("getGlobalStats", () => {
	test("returns zeros when no reactions exist", async () => {
		const stats = await getGlobalStats("all");

		expect(stats.totalReactions).toBe(0);
		expect(stats.topReactors).toHaveLength(0);
		expect(stats.topEmojis).toHaveLength(0);
		expect(stats.topReceivers).toHaveLength(0);
	});

	test("returns top reactors sorted by count", async () => {
		// User 10 reacts 3 times
		await createReaction({ userId: 10n, messageId: 1n });
		await createReaction({ userId: 10n, messageId: 2n });
		await createReaction({ userId: 10n, messageId: 3n });
		// User 11 reacts 1 time
		await createReaction({ userId: 11n, messageId: 4n });

		const stats = await getGlobalStats("all");

		expect(stats.totalReactions).toBe(4);
		expect(stats.topReactors.length).toBeGreaterThanOrEqual(2);

		const user10 = stats.topReactors.find((r) => r.userId === 10n);
		const user11 = stats.topReactors.find((r) => r.userId === 11n);
		expect(user10).toBeDefined();
		expect(user10?.count).toBe(3);
		expect(user11).toBeDefined();
		expect(user11?.count).toBe(1);
	});

	test("returns top emojis sorted by count", async () => {
		await createReaction({ userId: 10n, messageId: 1n, emojiName: "👍" });
		await createReaction({ userId: 11n, messageId: 2n, emojiName: "👍" });
		await createReaction({ userId: 12n, messageId: 3n, emojiName: "❤️" });

		const stats = await getGlobalStats("all");

		expect(stats.topEmojis[0].emojiName).toBe("👍");
		expect(stats.topEmojis[0].count).toBe(2);
	});

	test("returns top receivers sorted by count", async () => {
		// Author 2n gets 3 reactions
		await createReaction({ userId: 10n, messageId: 1n, messageAuthorId: 2n });
		await createReaction({
			userId: 11n,
			messageId: 1n,
			messageAuthorId: 2n,
			emojiName: "❤️",
		});
		await createReaction({ userId: 12n, messageId: 2n, messageAuthorId: 2n });
		// Author 3n gets 1 reaction
		await createReaction({ userId: 10n, messageId: 3n, messageAuthorId: 3n });

		const stats = await getGlobalStats("all");

		const author2 = stats.topReceivers.find((r) => r.messageAuthorId === 2n);
		expect(author2).toBeDefined();
		expect(author2?.count).toBe(3);
	});

	test("filters by time period", async () => {
		const now = new Date();
		const twoMonthsAgo = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 60);

		await createReaction({ userId: 10n, messageId: 1n, reactedAt: now });
		await createReaction({
			userId: 11n,
			messageId: 2n,
			reactedAt: twoMonthsAgo,
		});

		const weekStats = await getGlobalStats("week");
		expect(weekStats.totalReactions).toBe(1);

		const allStats = await getGlobalStats("all");
		expect(allStats.totalReactions).toBe(2);
	});
});

// ── getTopMessages ──────────────────────────────────────

describe("getTopMessages", () => {
	test("returns empty array when no reactions exist", async () => {
		const result = await getTopMessages("all");
		expect(result).toHaveLength(0);
	});

	test("returns messages sorted by reaction count", async () => {
		// Message 1 gets 3 reactions
		await createReaction({ userId: 10n, messageId: 1n, emojiName: "👍" });
		await createReaction({ userId: 11n, messageId: 1n, emojiName: "❤️" });
		await createReaction({ userId: 12n, messageId: 1n, emojiName: "🔥" });
		// Message 2 gets 1 reaction
		await createReaction({ userId: 10n, messageId: 2n, emojiName: "👍" });

		const result = await getTopMessages("all");

		expect(result.length).toBeGreaterThanOrEqual(2);
		expect(result[0].messageId).toBe(1n);
		expect(result[0].reactionCount).toBe(3);
		expect(result[0].uniqueReactors).toBe(3);
		expect(result[1].messageId).toBe(2n);
		expect(result[1].reactionCount).toBe(1);
	});

	test("counts unique reactors per message correctly", async () => {
		// Same user reacts with 2 different emojis on same message
		await createReaction({ userId: 10n, messageId: 1n, emojiName: "👍" });
		await createReaction({ userId: 10n, messageId: 1n, emojiName: "❤️" });
		// Different user reacts
		await createReaction({ userId: 11n, messageId: 1n, emojiName: "👍" });

		const result = await getTopMessages("all");

		expect(result[0].reactionCount).toBe(3);
		expect(result[0].uniqueReactors).toBe(2);
	});

	test("filters by time period", async () => {
		const now = new Date();
		const threeMonthsAgo = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 90);

		await createReaction({ userId: 10n, messageId: 1n, reactedAt: now });
		await createReaction({
			userId: 11n,
			messageId: 2n,
			reactedAt: threeMonthsAgo,
		});

		const monthResult = await getTopMessages("month");
		expect(monthResult).toHaveLength(1);
		expect(monthResult[0].messageId).toBe(1n);

		const allResult = await getTopMessages("all");
		expect(allResult).toHaveLength(2);
	});

	test("respects limit parameter", async () => {
		for (let i = 0; i < 5; i++) {
			await createReaction({
				userId: BigInt(10 + i),
				messageId: BigInt(100 + i),
			});
		}

		const result = await getTopMessages("all", 3);
		expect(result.length).toBeLessThanOrEqual(3);
	});
});
