import {EventHandler} from './EventHandler.js'
import {logger} from './logging.js'

// const welcomeChannelId = '821743171942744114'
export const joinLeaveListener: EventHandler = (client) => {
	client.on('guildMemberAdd', async message => {
		logger.info(`${message.user.username} joined ${message.guild.name}`)
	})
}