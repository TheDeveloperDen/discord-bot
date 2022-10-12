import {EventListener} from "../module.js";
import {config} from "../../Config.js";
import {Message} from "discord.js";

export const PollListener: EventListener = {
	async messageReactionAdd(_, reaction) {
		if (reaction.partial) {
			try {
				await reaction.fetch();
			} catch (error) {
				console.error('Something went wrong when fetching the reaction:', error);
				return;
			}
		}
		const pollConfig = config.poll;
		if (pollConfig == null) {
			return
		}
		if (reaction.emoji.id !== pollConfig.emojiId && reaction.emoji.name !== pollConfig.emojiId) {
			return
		}
		const message = reaction.message;
		if (message.partial) {
			try {
				await message.fetch();
			} catch (error) {
				console.error('Something went wrong when fetching the message:', error);
				return;
			}
		}
		if ((!(message instanceof Message))) {
			return
		}
		await reaction.remove();
		await message.react(pollConfig.yesEmojiId);
		await message.react(pollConfig.noEmojiId);
	}
}