import { logger } from "../../logging.js";
import { getOrCreateUserById } from "../../store/models/DDUser.js";
import { ReactionStat } from "../../store/models/ReactionStat.js";
import type { EventListener } from "../module.js";

export const ReactionStatsListener: EventListener = {
	async messageReactionAdd(_, reaction, user) {
		if (!user || user.bot) return;

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
		const userId = BigInt(user.id);
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

		try {
			await Promise.all([
				getOrCreateUserById(userId),
				getOrCreateUserById(messageAuthorId),
			]);

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
		}
	},
};
