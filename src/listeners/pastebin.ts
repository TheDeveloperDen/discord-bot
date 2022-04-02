import {Listener} from './listener.js'
import {pastify} from '../util/pastify.js'
import {Channel, PartialDMChannel, TextChannel} from 'discord.js'
import {randomInt} from 'crypto'
import {Snowflake} from 'discord-api-types'

function isTextChannel(channel: Channel | PartialDMChannel): channel is TextChannel {
	return channel.type === 'GUILD_TEXT'
}

export const pastebinListener: Listener = (client) => {
	client.on('messageCreate', async (message) => {
		const pastified = await pastify(message)
		if (pastified) {
			message.channel.send(pastified)
			return
		}
	})
}
