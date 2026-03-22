import { Op, sql } from "@sequelize/core";
import { ReactionStat } from "../../store/models/ReactionStat.js";

export type TimePeriod = "day" | "week" | "month" | "year" | "all";

/**
 * Normalize a raw BigInt value from Sequelize.
 * SQLite stores bigints as strings with an "n" suffix (e.g. "10n"),
 * while PostgreSQL returns actual bigints. This handles both.
 */
function rawBigInt(value: bigint | string | number): bigint {
	if (typeof value === "bigint") return value;
	const s = String(value);
	return BigInt(s.endsWith("n") ? s.slice(0, -1) : s);
}

/**
 * Returns a Date cutoff for the given period, or null for "all".
 */
export function getDateCutoff(period: TimePeriod): Date | null {
	if (period === "all") return null;
	const now = new Date();
	switch (period) {
		case "day":
			return new Date(now.getTime() - 1000 * 60 * 60 * 24);
		case "week":
			return new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7);
		case "month":
			return new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30);
		case "year":
			return new Date(now.getTime() - 1000 * 60 * 60 * 24 * 365);
	}
}

function buildTimeWhere(cutoff: Date | null) {
	if (!cutoff) return {};
	return { reactedAt: { [Op.gte]: cutoff } };
}

// ─── User Stats ────────────────────────────────────────────

export interface UserEmojiStat {
	emojiName: string;
	isCustomEmoji: boolean;
	emojiId: bigint | null;
	count: number;
}

export interface UserStatsSummary {
	totalReactions: number;
	uniqueMessagesReacted: number;
	topEmojis: UserEmojiStat[];
}

/**
 * Get stats for a specific user: total reactions, unique messages, top 10 emojis.
 */
export async function getUserStats(
	userId: bigint,
	period: TimePeriod,
	limit = 10,
): Promise<UserStatsSummary> {
	const cutoff = getDateCutoff(period);
	const timeWhere = buildTimeWhere(cutoff);
	const where = { userId, ...timeWhere };

	const [totalReactions, uniqueMessagesResult, topEmojis] = await Promise.all([
		ReactionStat.count({ where }),

		ReactionStat.count({
			where,
			distinct: true,
			col: "messageId",
		}),

		ReactionStat.findAll({
			attributes: [
				"emojiName",
				"isCustomEmoji",
				"emojiId",
				[sql`COUNT(*)`, "count"],
			],
			where,
			group: ["emojiName", "isCustomEmoji", "emojiId"],
			order: [[sql`COUNT(*)`, "DESC"]],
			limit,
			raw: true,
		}) as Promise<Array<UserEmojiStat & { count: string }>>,
	]);

	return {
		totalReactions,
		uniqueMessagesReacted: uniqueMessagesResult,
		topEmojis: topEmojis.map((row) => ({
			emojiName: row.emojiName,
			isCustomEmoji: row.isCustomEmoji,
			emojiId: row.emojiId ? rawBigInt(row.emojiId) : null,
			count: Number(row.count),
		})),
	};
}

// ─── Global Stats ──────────────────────────────────────────

export interface GlobalTopReactor {
	userId: bigint;
	count: number;
}

export interface GlobalTopEmoji {
	emojiName: string;
	isCustomEmoji: boolean;
	emojiId: bigint | null;
	count: number;
}

export interface GlobalTopReceiver {
	messageAuthorId: bigint;
	count: number;
}

export interface GlobalStatsSummary {
	totalReactions: number;
	topReactors: GlobalTopReactor[];
	topEmojis: GlobalTopEmoji[];
	topReceivers: GlobalTopReceiver[];
}

/**
 * Global stats: total reactions, top reactors, most used emojis, most reacted-to users.
 */
export async function getGlobalStats(
	period: TimePeriod,
	limit = 10,
): Promise<GlobalStatsSummary> {
	const cutoff = getDateCutoff(period);
	const timeWhere = buildTimeWhere(cutoff);

	const [totalReactions, topReactors, topEmojis, topReceivers] =
		await Promise.all([
			ReactionStat.count({ where: timeWhere }),

			ReactionStat.findAll({
				attributes: ["userId", [sql`COUNT(*)`, "count"]],
				where: timeWhere,
				group: ["userId"],
				order: [[sql`COUNT(*)`, "DESC"]],
				limit,
				raw: true,
			}) as Promise<Array<{ userId: bigint; count: string }>>,

			ReactionStat.findAll({
				attributes: [
					"emojiName",
					"isCustomEmoji",
					"emojiId",
					[sql`COUNT(*)`, "count"],
				],
				where: timeWhere,
				group: ["emojiName", "isCustomEmoji", "emojiId"],
				order: [[sql`COUNT(*)`, "DESC"]],
				limit,
				raw: true,
			}) as Promise<
				Array<{
					emojiName: string;
					isCustomEmoji: boolean;
					emojiId: bigint | null;
					count: string;
				}>
			>,

			ReactionStat.findAll({
				attributes: ["messageAuthorId", [sql`COUNT(*)`, "count"]],
				where: timeWhere,
				group: ["messageAuthorId"],
				order: [[sql`COUNT(*)`, "DESC"]],
				limit,
				raw: true,
			}) as Promise<Array<{ messageAuthorId: bigint; count: string }>>,
		]);

	return {
		totalReactions,
		topReactors: topReactors.map((r) => ({
			userId: rawBigInt(r.userId),
			count: Number(r.count),
		})),
		topEmojis: topEmojis.map((e) => ({
			emojiName: e.emojiName,
			isCustomEmoji: e.isCustomEmoji,
			emojiId: e.emojiId ? rawBigInt(e.emojiId) : null,
			count: Number(e.count),
		})),
		topReceivers: topReceivers.map((r) => ({
			messageAuthorId: rawBigInt(r.messageAuthorId),
			count: Number(r.count),
		})),
	};
}

// ─── Message Stats ─────────────────────────────────────────

export interface MessageStat {
	messageId: bigint;
	messageAuthorId: bigint;
	channelId: bigint;
	reactionCount: number;
	uniqueReactors: number;
}

/**
 * Get the most reacted messages within a time period.
 */
export async function getTopMessages(
	period: TimePeriod,
	limit = 10,
): Promise<MessageStat[]> {
	const cutoff = getDateCutoff(period);
	const timeWhere = buildTimeWhere(cutoff);

	const rows = (await ReactionStat.findAll({
		attributes: [
			"messageId",
			"messageAuthorId",
			"channelId",
			[sql`COUNT(*)`, "reactionCount"],
			[sql`COUNT(DISTINCT "userId")`, "uniqueReactors"],
		],
		where: timeWhere,
		group: ["messageId", "messageAuthorId", "channelId"],
		order: [[sql`COUNT(*)`, "DESC"]],
		limit,
		raw: true,
	})) as Array<{
		messageId: bigint;
		messageAuthorId: bigint;
		channelId: bigint;
		reactionCount: string;
		uniqueReactors: string;
	}>;

	return rows.map((row) => ({
		messageId: rawBigInt(row.messageId),
		messageAuthorId: rawBigInt(row.messageAuthorId),
		channelId: rawBigInt(row.channelId),
		reactionCount: Number(row.reactionCount),
		uniqueReactors: Number(row.uniqueReactors),
	}));
}

// ─── Helpers ───────────────────────────────────────────────

/**
 * Format an emoji for display in Discord embeds.
 */
export function formatEmoji(
	emojiName: string,
	isCustomEmoji: boolean,
	emojiId: bigint | null,
): string {
	if (isCustomEmoji && emojiId) {
		return `<:${emojiName}:${emojiId}>`;
	}
	return emojiName;
}

/**
 * Human-readable period label.
 */
export function periodLabel(period: TimePeriod): string {
	switch (period) {
		case "day":
			return "Last 24 Hours";
		case "week":
			return "Last 7 Days";
		case "month":
			return "Last 30 Days";
		case "year":
			return "Last Year";
		case "all":
			return "All Time";
	}
}
