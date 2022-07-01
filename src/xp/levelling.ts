import {Message, TextChannel, User} from 'discord.js'
import {config} from '../Config.js'
import {Config} from '../config.type'
import {getMessages} from '../listeners/messageLogger.js'
import {logger} from '../logging.js'
import {compareTwoStrings as distance} from 'string-similarity'

// FIXME - ensure that the thresholds are good here
const similarityProportion = (a: string, b: string) => distance(a, b) / b.length
const minMessageLength = 6
const minDistance = 0.4

export async function shouldCountForStats(author: User, message: Message, channel: TextChannel, config: Config) {
	if (author.bot) return false
	if (channel.id == config.channels.botCommands) return false
	const content = message.content
	if (content.length < minMessageLength) return false
	const messages = getMessages(author)
	if (messages.filter(m => similarityProportion(m, content) < minDistance).length > 0) {
		logger.debug(`Discarded message ${message.id} from user ${author} because it was too similar to previous messages`)
		return false
	}

	const asArray = content.split('')
	return asArray.some(it => it.match(/[a-z ]/i))
}


export const tierOf = (level: number) => {
	if (level <= 0) return 0
	return 1 + Math.floor(level / 10)
}

export const tierRoleId = (level: number) => {
	const tier = tierOf(level)
	if (tier < config.roles.tiers.length) return config.roles.tiers[tier]
	return config.roles.tiers[config.roles.tiers.length - 1]
}
