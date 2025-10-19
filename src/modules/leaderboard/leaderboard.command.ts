import { Op, Sequelize, sql } from "@sequelize/core";
import type {
	APIApplicationCommandOptionChoice,
	GuildMember,
} from "discord.js";
import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
} from "discord.js";
import type { Command } from "djs-slash-helper";
import { wrapInTransaction } from "../../sentry.js";
import { Bump } from "../../store/models/Bump.js";
import { DDUser } from "../../store/models/DDUser.js";
import { branding } from "../../util/branding.js";
import { createStandardEmbed } from "../../util/embeds.js";
import { actualMention } from "../../util/users.js";
import { getActualDailyStreak } from "../xp/dailyReward.command.js";

import fn = sql.fn;
import col = sql.col;

import { Includeable } from "@sequelize/core/_non-semver-use-at-your-own-risk_/model.js";

type KeysMatching<T, V> = {
	[K in keyof T]-?: T[K] extends V ? K : never;
}[keyof T];

type LeaderboardSelection =
	| ((user: DDUser) => Promise<number>)
	| KeysMatching<DDUser, number | bigint>;

interface LeaderboardType extends APIApplicationCommandOptionChoice<string> {
	select: LeaderboardSelection;
	value: string;
	sortingValue?: keyof DDUser;
	filter?: (user: DDUser, count: number) => Promise<boolean>;
	format: (value: number | bigint) => string;
	useAggregation?: boolean;
}

const info: LeaderboardType[] = [
	{
		select: "xp",
		value: "xp",
		name: "XP",
		format: (value) => `${value.toLocaleString()} XP`,
	},
	{
		select: "level",
		value: "level",
		name: "Level",
		format: (value) => `Level ${value}`,
	},
	{
		name: "Current Daily Streak",
		value: "currentDailyStreak",
		select: async (user) => await getActualDailyStreak(user),
		format: (s) => `${formatDays(s)}`,
	},
	{
		name: "Highest Daily Streak",
		value: "highestDailyStreak",
		select: "highestDailyStreak",
		format: (s) => `${formatDays(s)}`,
	},
	{
		name: "Disboard Bumps",
		value: "bumps",
		useAggregation: true,
		select: async (user) => user.countBumps(),
		format: (value) =>
			value.toString() === "1" ? "1 Bump" : `${value.toString()} Bumps`,
	},
	{
		name: "Disboard Weekly Bumps",
		value: "weeklyBumps",
		useAggregation: true,
		select: async () => 0,
		format: (value) =>
			value.toString() === "1" ? "1 Bump" : `${value.toString()} Bumps`,
	},
];

export const LeaderboardCommand: Command<ApplicationCommandType.ChatInput> = {
	type: ApplicationCommandType.ChatInput,
	name: "leaderboard",
	description: "Show the top 10 users based on XP, Level, or Daily Streak",
	options: [
		{
			type: ApplicationCommandOptionType.String,
			name: "type",
			description: "The type of leaderboard to show",
			required: true,
			choices: info,
		},
	],

	handle: wrapInTransaction("leaderboard", async (_, interaction) => {
		await interaction.deferReply();
		const guild = interaction.guild;
		if (guild == null) {
			await interaction.followUp("This command can only be used in a server");
			return;
		}
		const option = interaction.options.get("type", true).value as string;
		const traitInfo = info.find((it) => it.value === option);
		if (traitInfo == null) {
			await interaction.followUp("Invalid leaderboard type");
			return;
		}
		if (traitInfo.value === "currentDailyStreak") {
			// manually refresh all the dailies. this is not very efficient
			const all = await DDUser.findAll();
			await Promise.all(all.map(getActualDailyStreak));
		}
		const { format, value, sortingValue, select, name, useAggregation } =
			traitInfo;

		const mappedUsers: {
			userId: string;
			count: number;
		}[] = [];

		// Use aggregation for bump-related leaderboards
		if (useAggregation && (value === "bumps" || value === "weeklyBumps")) {
			const weekCutoff =
				value === "weeklyBumps"
					? new Date(Date.now() - 1000 * 60 * 60 * 24 * 7)
					: null;

			const aggregatedUsers = await getUserAndBumpsAggregated(weekCutoff);

			for (const userData of aggregatedUsers) {
				const userId =
					typeof userData.id === "string" ? BigInt(userData.id) : userData.id;
				const user = await DDUser.findOne({
					where: {
						id: userId,
					},
				});
				if (!user) continue;

				const count = Number(userData.bumpsCount);
				if (count === 0) continue;

				mappedUsers.push({
					userId: user.id.toString(),
					count,
				});
			}
		} else {
			// Original logic for non-aggregation leaderboards
			const calculate: (user: DDUser) => Promise<number | bigint> =
				select instanceof Function
					? select
					: async (user: DDUser) => user[select];

			const users = await DDUser.findAll({
				order: [[sortingValue ?? value, "DESC"]],
				limit: 10,
			});

			for (const userToBeMapped of users) {
				const count = Number(await calculate(userToBeMapped));
				if (count === 0) {
					continue;
				}
				mappedUsers.push({
					userId: userToBeMapped.id.toString(),
					count: count,
				});
			}
		}

		if (mappedUsers.length === 0) {
			await interaction.followUp("No applicable users");
			return;
		}
		const embed = {
			...createStandardEmbed(interaction.member as GuildMember),
			title: `${branding.name} Leaderboard`,
			description: `The top ${mappedUsers.length} users based on ${name}`,
			fields: await Promise.all(
				mappedUsers.map(async (userData, index) => {
					const discordUser = await guild.client.users
						.fetch(userData.userId)
						.catch(() => null);

					return {
						name: `${medal(index)} #${index + 1} - ${format(userData.count)}`.trimStart(),
						value:
							discordUser == null ? "Unknown User" : actualMention(discordUser),
					};
				}),
			),
		};
		await interaction.followUp({ embeds: [embed] });
	}),
};

function medal(index: number): string {
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

function formatDays(days: number | bigint) {
	if (days === 1) {
		return "1 day";
	}
	return `${days} days`;
}

function getUserAndBumpsAggregated(after?: Date | null): Promise<
	Array<{
		id: string | bigint;
		bumpsCount: string | number;
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
		limit: 10,
		raw: true,
	});
}
