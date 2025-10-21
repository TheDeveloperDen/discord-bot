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
import { DDUser } from "../../store/models/DDUser.js";
import { branding } from "../../util/branding.js";
import { createStandardEmbed } from "../../util/embeds.js";
import { actualMention } from "../../util/users.js";
import { getActualDailyStreak } from "../xp/dailyReward.command.js";

import { getUserAndBumpsAggregated, medal } from "./leaderboard.js";

// For Bump Leaderboard
interface MappedUser {
	userId: string;
	count: number;
}

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

async function getAggregatedLeaderboardUsers(
	traitInfo: LeaderboardType,
): Promise<MappedUser[]> {
	const { value } = traitInfo;
	const weekCutoff =
		value === "weeklyBumps"
			? new Date(Date.now() - 1000 * 60 * 60 * 24 * 7)
			: null;

	const aggregatedUsers = await getUserAndBumpsAggregated(weekCutoff);
	const mappedUsers: MappedUser[] = [];

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

	return mappedUsers;
}

async function getStandardLeaderboardUsers(
	traitInfo: LeaderboardType,
): Promise<MappedUser[]> {
	const { select, sortingValue, value } = traitInfo;
	const calculate: (user: DDUser) => Promise<number | bigint> =
		select instanceof Function ? select : async (user: DDUser) => user[select];

	const users = await DDUser.findAll({
		order: [[sortingValue ?? value, "DESC"]],
		limit: 10,
	});

	const mappedUsers: MappedUser[] = [];
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

	return mappedUsers;
}

async function getLeaderboardUsers(
	traitInfo: LeaderboardType,
): Promise<MappedUser[]> {
	const { value, useAggregation } = traitInfo;
	// handle if the user is trying to get bumps or weekly bumps
	if (useAggregation && (value === "bumps" || value === "weeklyBumps")) {
		return await getAggregatedLeaderboardUsers(traitInfo);
	} else {
		return await getStandardLeaderboardUsers(traitInfo);
	}
}

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
		const { format, name } = traitInfo;

		const mappedUsers = await getLeaderboardUsers(traitInfo);

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

function formatDays(days: number | bigint) {
	if (days === 1) {
		return "1 day";
	}
	return `${days} days`;
}
