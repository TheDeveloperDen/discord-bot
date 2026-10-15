import { Op, QueryTypes, sql, type WhereOptions } from "@sequelize/core";
import { DDUser } from "../../store/models/DDUser.js";
import { getSequelizeInstance } from "../../store/storage.js";
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
	if ("bumps" in leaderboard) {
		return getBumpsPage(
			leaderboard.bumps === "weekly"
				? new Date(Date.now() - 1000 * 60 * 60 * 24 * 7)
				: null,
			{ offset, limit },
		);
	}

	const { column } = leaderboard;
	// ties by id, so they don't swap between pages
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

/**
 * Each user's bump count: Bump rows since `after`, or all of them plus the pre-Bump-table `bumps`
 * column. Bumps are counted in one grouped pass and joined on
 */
async function getBumpsPage(
	after: Date | null,
	{ offset, limit }: PageRequest,
): Promise<Page<LeaderboardEntry>> {
	const bumpCount = after
		? sql`"counts"."bumps"`
		: sql`(COALESCE("counts"."bumps", 0) + COALESCE("Users"."bumps", 0))`;
	// weekly only wants users who bumped this week; all-time also wants those with only historical bumps
	const from = sql`FROM "Users" ${after ? sql`INNER` : sql`LEFT`} JOIN (
		SELECT "userId", COUNT(*) AS "bumps" FROM "Bumps"
		${after ? sql`WHERE "timestamp" >= ${after}` : sql``}
		GROUP BY "userId"
	) AS "counts" ON "counts"."userId" = "Users"."id"
	WHERE ${bumpCount} > 0`;

	const sequelize = getSequelizeInstance();
	const [rows, [counted]] = await Promise.all([
		sequelize.query<{ id: unknown; bumpsCount: number | string }>(
			sql`SELECT "Users"."id", ${bumpCount} AS "bumpsCount" ${from}
			ORDER BY "bumpsCount" DESC, "Users"."id" ASC
			LIMIT ${limit} OFFSET ${offset}`,
			{ type: QueryTypes.SELECT },
		),
		sequelize.query<{ total: number | string }>(
			sql`SELECT COUNT(*) AS "total" ${from}`,
			{ type: QueryTypes.SELECT },
		),
	]);
	return {
		items: rows.map((row) => ({
			userId: parseUserId(row.id),
			count: Number(row.bumpsCount),
		})),
		total: Number(counted?.total ?? 0),
	};
}

/** Raw rows skip RealBigInt's parsing: Postgres gives the id as a string, SQLite (tests) as "123n" */
const parseUserId = (id: unknown) => String(id).replace(/n$/, "");

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
