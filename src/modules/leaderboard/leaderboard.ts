import { Op, sql, type WhereOptions } from "@sequelize/core";
import { DDUser } from "../../store/models/DDUser.js";
import type { Page, PageRequest } from "../../ui/index.js";
import { formatDayCount, STREAK_LAPSES_AFTER_MS } from "../xp/dailyStreak.js";

export interface LeaderboardEntry {
	userId: string;
	count: number;
}

type RankedColumn =
	| "xp"
	| "level"
	| "currentDailyStreak"
	| "highestDailyStreak";

export type Leaderboard = {
	/** The slash command choice */
	value: string;
	name: string;
	format: (count: number) => string;
} & (
	| {
			column: RankedColumn;
			/** Rows that count, on top of a non-zero column */
			where?: () => WhereOptions<DDUser>;
	  }
	/** Counts Bump rows, plus the historical `bumps` column when all-time */
	| { bumps: "allTime" | "weekly" }
);

const formatBumps = (bumps: number) =>
	bumps === 1 ? "1 Bump" : `${bumps} Bumps`;

export const leaderboards: Leaderboard[] = [
	{
		value: "xp",
		name: "XP",
		column: "xp",
		format: (xp) => `${xp.toLocaleString()} XP`,
	},
	{
		value: "level",
		name: "Level",
		column: "level",
		format: (level) => `Level ${level}`,
	},
	{
		value: "currentDailyStreak",
		name: "Current Daily Streak",
		column: "currentDailyStreak",
		// the stored streak is only reset when next read, so lapsed ones are left out here
		where: () => ({
			lastDailyTime: { [Op.gt]: new Date(Date.now() - STREAK_LAPSES_AFTER_MS) },
		}),
		format: formatDayCount,
	},
	{
		value: "highestDailyStreak",
		name: "Highest Daily Streak",
		column: "highestDailyStreak",
		format: formatDayCount,
	},
	{
		value: "bumps",
		name: "Disboard Bumps",
		bumps: "allTime",
		format: formatBumps,
	},
	{
		value: "weeklyBumps",
		name: "Disboard Weekly Bumps",
		bumps: "weekly",
		format: formatBumps,
	},
];

export function leaderboardFor(value: string): Leaderboard {
	const leaderboard = leaderboards.find((it) => it.value === value);
	if (!leaderboard) throw new Error(`Unknown leaderboard ${value}`);
	return leaderboard;
}

export async function getLeaderboardPage(
	leaderboard: Leaderboard,
	{ offset, limit }: PageRequest,
): Promise<Page<LeaderboardEntry>> {
	// ties by id, so they don't swap between pages
	if ("bumps" in leaderboard) {
		const count = bumpCount(
			leaderboard.bumps === "weekly"
				? new Date(Date.now() - 1000 * 60 * 60 * 24 * 7)
				: null,
		);
		const where = sql`${count} > 0`;
		const [users, total] = await Promise.all([
			// not raw, so RealBigInt parses the ids
			DDUser.findAll({
				attributes: ["id", [count, "bumpsCount"]],
				where,
				order: [
					[count, "DESC"],
					["id", "ASC"],
				],
				offset,
				limit,
			}),
			DDUser.count({ where }),
		]);
		return {
			items: users.map((user) => ({
				userId: user.id.toString(),
				count: Number(user.get("bumpsCount")),
			})),
			total,
		};
	}

	const { column } = leaderboard;
	const { rows, count } = await DDUser.findAndCountAll({
		attributes: ["id", column],
		where: {
			[column]: { [Op.gt]: column === "xp" ? 0n : 0 },
			...leaderboard.where?.(),
		},
		order: [
			[column, "DESC"],
			["id", "ASC"],
		],
		offset,
		limit,
	});
	return {
		items: rows.map((user) => ({
			userId: user.id.toString(),
			count: Number(user[column]),
		})),
		total: count,
	};
}

/** Each user's bump count: Bump rows since `after`, or all of them plus the pre-Bump-table `bumps` column */
const bumpCount = (after: Date | null) =>
	sql`((SELECT COUNT(*) FROM "Bumps" WHERE "Bumps"."userId" = "DDUser"."id" ${
		after ? sql`AND "Bumps"."timestamp" >= ${after}` : sql``
	}) + ${after ? sql`0` : sql`COALESCE("DDUser"."bumps", 0)`})`;

export function medal(index: number): string {
	switch (index) {
		case 0:
			return "🥇";
		case 1:
			return "🥈";
		case 2:
			return "🥉";
		default:
			return "";
	}
}
