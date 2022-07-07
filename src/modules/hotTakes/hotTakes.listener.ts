import {Client, TextChannel} from 'discord.js'
import {config} from '../../Config.js'
import {EventListener} from '../module.js'
import generateHotTake from './hotTakes.util.js'

async function sendHotTake(client: Client) {
	const channel = await client.channels.fetch(config.channels.hotTake) as TextChannel
	const lastMessage = await channel.messages.fetch({limit: 1}).then(m => m.first())
	const lastMessageSentAt = lastMessage?.createdAt ?? new Date(0)
	const timeSinceLastMessage = (Date.now() - lastMessageSentAt.getTime()) / 1000
	if (lastMessage?.author == client.user || timeSinceLastMessage < 60 * 30) {
		return
	}
	const hotTake = await generateHotTake(channel.guild)
	await channel.send({content: hotTake, allowedMentions: {users: []}})
}

async function hotTakeLoop(client: Client) {
	await sendHotTake(client)
	setTimeout(async () => {
		await hotTakeLoop(client)
	}, 60 * 1000)
}

export const HotTakeListener: EventListener = {
	ready: hotTakeLoop
}

export default HotTakeListener
