import * as Sentry from "@sentry/bun";
import type { Channel } from "discord.js";
import { config } from "../../Config.js";
import { logger } from "../../logging.js";
import { getOrCreateUserById } from "../../store/models/DDUser.js";
import { notifyMultipleAchievements } from "../achievements/achievementNotifier.js";
import { checkAndAwardAchievements } from "../achievements/achievementService.js";
import type { EventListener } from "../module.js";
import {
	giveXp,
	shouldCountForStats,
	xpForMessage,
} from "./xpForMessage.util.js";

export const XpListener: EventListener = {
	async messageCreate(_client, msg) {
		await Sentry.startSpan({ name: "messageCreate", op: "event" }, async () => {
			if (msg.guild == null) return;
			const author = msg.member;
			if (!author) return;

			const shouldCount = await shouldCountForStats(
				msg.author,
				msg,
				msg.channel as Channel,
				config,
			);
			if (shouldCount) {
				logger.debug(`counting message ${msg.id} for XP for ${msg.author.id}`);
				const xp = xpForMessage(msg.content);
				await giveXp(author, xp);

				// Check and award XP achievements
				try {
					const ddUser = await getOrCreateUserById(BigInt(msg.author.id));
					const newAchievements = await checkAndAwardAchievements(
						ddUser,
						{ type: "xp", event: "xp_gained" },
						{ totalXp: ddUser.xp, level: ddUser.level },
					);

					if (newAchievements.length > 0) {
						await notifyMultipleAchievements(
							msg.client,
							author,
							newAchievements.map((a) => a.definition),
							msg.channel,
						);
					}
				} catch (error) {
					logger.error("Failed to check XP achievements:", error);
				}
			}
		});
	},
};
