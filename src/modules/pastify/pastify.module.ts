import Module from '../module.js'
import {pastify} from './pastify.js'
import {PastifyCommand} from './pastify.command.js'
import {PasteCommand} from './paste.command.js'
import {PermissionFlagsBits} from 'discord-api-types/v10'
import {StageChannel} from 'discord.js'

export const PastifyModule: Module = {
	name: 'pastify',
	commands: [PastifyCommand, PasteCommand],
	listeners: [{
		async messageCreate(_, message) {
			if (message.channel instanceof StageChannel) {
				return // shouldnt be possible
			}
			if (message.channel.isThread()) {
				return // Don't pastify messages in threads since theres nothing to "interrupt"
			}
			if (message.author.bot) {
				return // Don't pastify messages from bots, it makes things like /run behave weirdly
			}
			if (message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
				return // Don't pastify messages from staff as they should know better
			}
			const pastified = await pastify(message)
			if (pastified) return message.channel.send({...pastified, flags: undefined})
		}
	}]
}

export default PastifyModule
