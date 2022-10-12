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
		console.log(reaction);
		const pollConfig = config.poll;
		console.log(pollConfig);
		if (pollConfig == null) {
			return
		}
		console.log(reaction.emoji)
		if (reaction.emoji.id !== pollConfig.emojiId && reaction.emoji.name !== pollConfig.emojiId) {
			return
		}
		const message = reaction.message;
		if ((!(message instanceof Message))) {
			return
		}
		await message.react(pollConfig.yesEmojiId);
		await message.react(pollConfig.noEmojiId);
	}
}