import {EventHandler} from '../EventHandler.js'
import {getUserById} from '../store/models/DDUser.js'
import {logger} from '../logging.js'
import {config} from '../Config.js'
import {Message, TextChannel} from 'discord.js'
import {sentry} from '../util/errors.js'


const disboardId = '302050872383242240'

export const bumpNotificationListener: EventHandler = (client) => {

	const successPredicate = (msg: Message) =>
		(msg.author.id == disboardId &&
			msg.embeds[0]?.description?.includes(':thumbsup:') &&
			Date.now() - msg.createdTimestamp <= 7200 * 1000
		) ?? false

	const sendBumpMessage = async () => {
		const channel = await client.channels.fetch(config.channels.botCommands) as TextChannel
		await channel.send(`<@&${config.roles.bumpNotifications}>, the server is ready to be bumped! **!d bump**`)
	}

	const init = async () => {
		const botChannel = await client.channels.fetch(config.channels.botCommands) as TextChannel

		const lastMessage = botChannel.messages.cache.find(successPredicate)
		const delay = 7200 * 1000 + (lastMessage?.createdTimestamp || Date.now()) - Date.now()
		logger.info(`Next bump due in ${delay / 60000} minutes`)
		setTimeout(sendBumpMessage, delay)
	}
	
	client.once('ready', init)

	client.on('messageCreate', async message => {
		if (message.content !== '!d bump') return

		let messages
		try {
			messages = await message.channel.awaitMessages({
				filter: successPredicate,
				max: 1,
				time: 3000
			})
		} catch (e) {
			sentry(e)
			return
		}
		if (messages.size == 0) return


		const user = await getUserById(BigInt(message.author.id))
		user.bumps++
		await user.save()
		logger.info(`Incremented bumps for ${message.author.username}`)
		setTimeout(sendBumpMessage, 1000 * 60 * 60 * 2)
	})
}
