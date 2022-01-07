import {distance} from 'fastest-levenshtein'
import {Message, TextChannel, User} from 'discord.js'
import {Config} from '../Config.js'
import {getMessages} from '../listeners/messageLogger.js'
import {logger} from '../logging.js'

const similarityProportion = (a: string, b: string) => distance(a, b) / b.length
const minMessageLength = 6
const minDistance = 0.4

export async function shouldCountForStats(author: User, message: Message, channel: TextChannel, config: Config) {
	if (author.bot) return false
	if (channel.id == config.botCommandsChannelId) return false
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


export const tierRoles = [
	'821743100203368458', //@everyone (tier 0)
	'823167811555033150', // tier 1
	'837653180774875178', // 2
	'837661828405395476', // 3
	'837662055921221712', // 4
	'837662277577998356', // 5
	'837662496432193640', // 6
	'837662699235311616', // 7
	'837662908703703070', // 8
	'837663085657194546', // 9
	'837663288064999424', // 10
]

export const tierOf = (level: number) => {
	if (level <= 0) return 0
	return 1 + Math.floor(level / 10)
}

export const tierRoleId = (level: number) => {
	const tier = tierOf(level)
	if (tier < tierRoles.length) return tierRoles[tier]
	return tierRoles[tierRoles.length - 1]
}