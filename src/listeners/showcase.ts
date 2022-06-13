import {Listener} from './listener.js'
import {config} from '../Config.js'

export const showcaseListener: Listener = client => {
	client.on('messageCreate', async message => {
		if (message.channel.id !== config.channels.showcase) return
		await message.react('👍')
		await message.react('👎')
	})
}