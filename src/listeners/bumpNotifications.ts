import {Listener} from './listener.js'
import {getUserById} from '../store/models/DDUser.js'
import {logger} from '../logging.js'
import {config} from '../Config.js'
import {Message, TextChannel} from 'discord.js'
import {sentry} from '../util/errors.js'


const disboardId = '302050872383242240'
const twoHours = 7200000

export const bumpNotificationListener: Listener = (client) => {

	const bumpPredicate = (msg: Message) =>
		(msg.author.id == disboardId && msg.embeds[0]?.description?.includes('Bump done!')) ?? false

	const sendBumpMessage = async () => {
		const channel = await client.channels.fetch(config.channels.botCommands) as TextChannel
		await channel.send(`<@&${config.roles.bumpNotifications}>, the server is ready to be bumped! **/bump**`)
	}

	const init = async () => {
		const botChannel = await client.channels.fetch(config.channels.botCommands) as TextChannel

		const lastMessage = botChannel.messages.cache.find(bumpPredicate)
		const delay = twoHours + (lastMessage?.createdTimestamp || Date.now()) - Date.now()
		logger.info(`Next bump due in ${delay / 60000} minutes`)
		setTimeout(sendBumpMessage, (delay < 0 ? 0 : delay))
	}
	
	client.once('ready', init)

	client.on('interactionCreate', async interaction => {
		if (!interaction.isCommand()) return
		if (interaction.commandName !== 'bump') return

		let messages
		try {
			messages = await interaction.channel?.awaitMessages({
				filter: bumpPredicate,
				max: 1,
				time: 3000
			})
		} catch (e) {
			sentry(e)
			return
		}
		if (messages?.size == 0) return


		const user = await getUserById(BigInt(interaction.user.id))
		user.bumps++
		await user.save()
		logger.info(`Incremented bumps for ${interaction.user.username}`)
		setTimeout(sendBumpMessage, twoHours)
	})
}
