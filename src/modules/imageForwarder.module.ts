import Module from './module.js'
import {config} from '../Config.js'
import {TextChannel} from 'discord.js'
import {actualMention} from '../util/users.js'

const ImageForwarderModule: Module = {
	name: 'imageForwarder',
	listeners: [{
		async messageCreate(client, message) {
			if (message.author.bot) return
			const channel = await client.channels.fetch(config.channels.auditLog)
			if (!(channel instanceof TextChannel)) return
			const attachments = message.attachments
			if (!attachments?.size) return
			return channel.send({
				content: `Message from ${actualMention(message.author)} at <t:${message.createdTimestamp}>
${attachments.map(it => it.url).join(' ')}`,
				allowedMentions: {users: []}
			})
		}
	}]
}

export default ImageForwarderModule
