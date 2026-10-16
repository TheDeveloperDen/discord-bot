import { logger } from "../../logging.js";
import { type DDUser, getOrCreateUserById } from "../../store/models/DDUser.js";
import { ReactionStat } from "../../store/models/ReactionStat.js";
import { notifyMultipleAchievements } from "../achievements/achievementNotifier.js";
import { checkAndAwardAchievements } from "../achievements/achievementService.js";
import type { EventListener } from "../module.js";
import { getRecipientReactionMetrics } from "./reactionStats.service.js";

export const ReactionStatsListener: EventListener = {
	async messageReactionAdd(client, reaction, user) {
		if (!user) return;

		let reactor = user;
		if (reactor.partial) {
			try {
				reactor = await reactor.fetch();
			} catch (error) {
				logger.error("ReactionStats: Failed to fetch partial reactor:", error);
				return;
			}
		}
		if (reactor.bot || reactor.system) return;

		if (reaction.partial) {
			try {
				await reaction.fetch();
			} catch (error) {
				logger.error("ReactionStats: Failed to fetch partial reaction:", error);
				return;
			}
		}

		let message = reaction.message;
		if (message.partial) {
			try {
				message = await message.fetch();
			} catch (error) {
				logger.error("ReactionStats: Failed to fetch partial message:", error);
				return;
			}
		}

		if (!message.inGuild()) return;
		if (message.author.bot || message.author.system) return;

		const emoji = reaction.emoji;
		const emojiName = emoji.id ? (emoji.name ?? emoji.id) : emoji.name;
		if (!emojiName) return;
		const isCustomEmoji = emoji.id !== null;
		const userId = BigInt(reactor.id);
		const messageId = BigInt(message.id);
		const messageAuthorId = BigInt(message.author.id);
		const emojiId = isCustomEmoji && emoji.id ? BigInt(emoji.id) : null;
		const where = isCustomEmoji
			? {
					userId,
					messageId,
					isCustomEmoji,
					emojiId,
				}
			: {
					userId,
					messageId,
					isCustomEmoji,
					emojiName,
				};

		let messageAuthor: DDUser;
		try {
			const [, createdMessageAuthor] = await Promise.all([
				getOrCreateUserById(userId),
				getOrCreateUserById(messageAuthorId),
			]);
			messageAuthor = createdMessageAuthor;

			await ReactionStat.findOrCreate({
				where,
				defaults: {
					userId,
					messageId,
					messageAuthorId,
					channelId: BigInt(message.channelId),
					emojiName,
					emojiId,
					isCustomEmoji,
					reactedAt: new Date(),
				},
			});
		} catch (error) {
			logger.error("ReactionStats: Failed to save reaction stat:", error);
			return;
		}

		try {
			const reactionMetrics =
				await getRecipientReactionMetrics(messageAuthorId);
			const newAchievements = await checkAndAwardAchievements(
				messageAuthor,
				{ type: "reaction", event: "reaction_received" },
				reactionMetrics,
			);

			if (newAchievements.length > 0) {
				const member = await message.guild?.members.fetch(message.author.id);
				if (member) {
					await notifyMultipleAchievements(
						client,
						member,
						newAchievements.map((achievement) => achievement.definition),
						message.channel,
					);
				}
			}
		} catch (error) {
			logger.error(
				"ReactionStats: Failed to check reaction achievements:",
				error,
			);
		}
	},
};
