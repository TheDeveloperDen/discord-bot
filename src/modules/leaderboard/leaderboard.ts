import { sql } from "@sequelize/core";
import { DDUser } from "../../store/models/DDUser.js";

export function getUserAndBumpsAggregated(
	after?: Date | null,
	limit: number = 10,
): Promise<
	Array<{
		id: string | bigint;
		bumpsCount: number;
	}>
> {
	// Build the timestamp filter SQL
	const timestampFilter = after
		? sql`AND "Bumps"."timestamp" >=
          ${after}`
		: sql``;

	// Only add historical bumps if we're not filtering by date (i.e., showing all-time bumps)
	const historicalBumps = after
		? sql`0`
		: sql`"DDUser"
          .
          "bumps"`;

	return DDUser.findAll({
		attributes: [
			"id",
			[
				sql`(SELECT COALESCE(COUNT(*), 0) + ${historicalBumps}
             FROM "Bumps"
             WHERE "Bumps"."userId" = "DDUser"."id"
                 ${timestampFilter})`,
				"bumpsCount",
			],
		],
		order: [
			[
				sql`(SELECT COALESCE(COUNT(*), 0) + ${historicalBumps}
             FROM "Bumps"
             WHERE "Bumps"."userId" = "DDUser"."id"
                 ${timestampFilter})`,
				"DESC",
			],
		],
		limit: limit,
		raw: true,
	});
}

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
