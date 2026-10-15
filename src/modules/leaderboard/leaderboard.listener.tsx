import type { Guild } from "discord.js";
import { Message, renderDiscordMessage } from "disjsx";
import * as schedule from "node-schedule";
import { config } from "../../Config.js";
import { logger } from "../../logging.js";
import { runObserved } from "../../observe.js";
import type { EventListener } from "../module.js";
import { LeaderboardCard } from "./leaderboard.card.js";
import { getLeaderboardPage, leaderboardFor } from "./leaderboard.js";

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
	const weekly = leaderboardFor("weeklyBumps");
	const { items } = await getLeaderboardPage(weekly, { offset: 0, limit: 3 });

	if (items.length === 0) {
		logger.info("No users bumped in the last week, skipping leaderboard post.");
		return;
	}

	await announcementChannel.send({
		...renderDiscordMessage(
			<Message isV2>
				<LeaderboardCard
					leaderboard={weekly}
					entries={items}
					offset={0}
					title="Weekly Bump Leaderboard"
					accent="Gold"
				/>
			</Message>,
		),
		allowedMentions: { parse: [] },
	});
}

export const LeaderboardListener: EventListener = {
	clientReady: async (client) => {
		const guild = await client.guilds.fetch(config.guildId);
		schedule.scheduleJob(
			{
				hour: 6,
				minute: 0,
				dayOfWeek: 1, // 0 = Sunday, 1 = Monday, etc.
			},
			() =>
				runObserved(
					{
						op: "job",
						name: "leaderboard.weekly",
						monitor: { slug: "leaderboard-weekly", crontab: "0 6 * * 1" },
					},
					() => postLeaderboard(guild),
				),
		);
	},
};
