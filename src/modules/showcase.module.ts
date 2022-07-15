import Module from './module.js'
import {config} from '../Config.js'

export const ShowcaseModule: Module = {
	name: 'showcase',
	listeners: [{
		async messageCreate(_, message) {
			if (message.channel.id !== config.channels.showcase) return
			if (message.author.bot || message.system) return
			await message.react('👍')
			await message.react('👎')
		}
	}]
}
