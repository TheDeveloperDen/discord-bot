import { logger } from "../../logging.js";
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

		try {
			await ReactionStat.findOrCreate({
				where: {
					userId: BigInt(user.id),
					messageId: BigInt(message.id),
					emojiName: emojiName,
				},
				defaults: {
					userId: BigInt(user.id),
					messageId: BigInt(message.id),
					messageAuthorId: BigInt(message.author.id),
					channelId: BigInt(message.channelId),
					emojiName: emojiName,
					emojiId: emoji.id ? BigInt(emoji.id) : null,
					isCustomEmoji: emoji.id !== null,
					reactedAt: new Date(),
				},
			});
		} catch (error) {
			logger.error("ReactionStats: Failed to save reaction stat:", error);
		}
	},
};
