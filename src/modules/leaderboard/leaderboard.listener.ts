import { EmbedBuilder, type Guild } from "discord.js";
import * as schedule from "node-schedule";
import { config } from "../../Config.js";
import { logger } from "../../logging.js";
import { actualMention } from "../../util/users.js";
import { format } from "../core/info.command.js";
import type { EventListener } from "../module.js";
import { getUserAndBumpsAggregated, medal } from "./leaderboard.js";

async function postLeaderboard(guild: Guild) {
	if (config.channels.leaderboard == null) {
		logger.info(
			"Leaderboard channel not configured, skipping leaderboard post.",
		);
		return;
	}
	const announcementChannel = await guild.channels.fetch(
		config.channels.leaderboard,
	);
	if (announcementChannel == null) {
		logger.info("Leaderboard channel not found, skipping leaderboard post.");
		return;
	}
	if (!announcementChannel.isTextBased() || !announcementChannel.isSendable()) {
		logger.info(
			"Leaderboard channel is not a text channel or not sendable, skipping leaderboard post.",
		);
		return;
	}
	const weekCutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);
	const bumpLeaderboard = (
		await getUserAndBumpsAggregated(weekCutoff, 3)
	).filter((userData) => userData.bumpsCount > 0);

	if (bumpLeaderboard.length === 0) {
		logger.info("No users bumped in the last week, skipping leaderboard post.");
		return;
	}

	const embed = new EmbedBuilder()
		.setTitle("Weekly Bump Leaderboard")
		.setColor("Gold");

	const fields = await Promise.all(
		bumpLeaderboard.map(async (userData, index) => {
			const discordUser = await guild.client.users
				.fetch(userData.id.toString())
				.catch(() => null);

			return {
				name: `${medal(index)} #${index + 1} - ${userData.bumpsCount} ${userData.bumpsCount > 1 ? "Bumps" : "Bump"}`.trimStart(),
				value:
					discordUser == null ? "Unknown User" : actualMention(discordUser),
			};
		}),
	);

	embed.addFields(fields);

	await announcementChannel.send({ embeds: [embed] });
}

export const LeaderboardListener: EventListener = {
	clientReady: async (client) => {
		const guild = await client.guilds.fetch(config.guildId);
		schedule.scheduleJob(
			{
				hour: 0,
				minute: 0,
				second: 0,
			},
			async () => {
				await postLeaderboard(guild);
			},
		);
	},
};
