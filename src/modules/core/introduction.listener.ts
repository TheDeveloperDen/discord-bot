import { config } from "../../Config.js";
import { logger } from "../../logging.js";
import { getOrCreateUserById } from "../../store/models/DDUser.js";
import { notifyMultipleAchievements } from "../achievements/achievementNotifier.js";
import { checkAndAwardAchievements } from "../achievements/achievementService.js";
import type { EventListener } from "../module.js";

export const IntroListener: EventListener = {
	messageCreate: async (client, message) => {
		if (message.author.bot) return;
		if (message.channelId !== config.channels.introductions) return;
		await message.react("👋");
		await message.startThread({
			name: `Welcome ${message.author.username}!`,
			reason: `Welcome to the server! Use this thread to discuss your introduction if you want, or come and say hi in <#${config.channels.general}>`,
		});

		try {
			const user = await getOrCreateUserById(BigInt(message.author.id));
			const newAchievements = await checkAndAwardAchievements(
				user,
				{ type: "introduction", event: "intro_posted" },
				{},
			);

			if (newAchievements.length > 0) {
				const member = await message.guild?.members.fetch(message.author.id);
				if (member) {
					await notifyMultipleAchievements(
						client,
						member,
						newAchievements.map((a) => a.definition),
						message.channel,
					);
				}
			}
		} catch (error) {
			logger.error("Failed to check introduction achievements", error);
		}
	},
};
