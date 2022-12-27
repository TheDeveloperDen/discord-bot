import {EventListener} from '../module.js'
import {config} from '../../Config.js'
import {Message, PartialUser, User} from 'discord.js'
import {isSpecialUser} from '../../util/users.js'

export const PollListener: EventListener = {
	async messageReactionAdd(_, reaction, user: User | PartialUser) {
		if (reaction.partial) {
			try {
				await reaction.fetch()
			} catch (error) {
				console.error('Something went wrong when fetching the reaction:', error)
				return
			}
		}
		const pollConfig = config.poll
		if (pollConfig == null) {
			return
		}
		if (reaction.emoji.id !== pollConfig.emojiId && reaction.emoji.name !== pollConfig.emojiId) {
			return
		}
		const message = reaction.message
		if (message.partial) {
			try {
				await message.fetch()
			} catch (error) {
				console.error('Something went wrong when fetching the message:', error)
				return
			}
		}
		if ((!(message instanceof Message))) {
			return
		}
		if (user.partial) {
			try {
				await user.fetch()
			} catch (error) {
				console.error('Something went wrong when fetching the user:', error)
				return
			}
		}
		if (!reaction.message.guild) {
			return
		}
		const member = await reaction.message.guild.members.fetch(user.id)
		if (!member) {
			return
		}

		if (!isSpecialUser(member)) {
			return
		}
		await reaction.remove()
		await message.react(pollConfig.yesEmojiId)
		await message.react(pollConfig.noEmojiId)
	}
}