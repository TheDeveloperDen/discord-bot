import Module from '../module.js'
import {pastify} from './pastify.js'
import {PastifyCommand} from './pastify.command.js'

export const PastifyModule: Module = {
	name: 'pastify',
	commands: [PastifyCommand],
	listeners: [{
		async messageCreate(_, message) {
			const pastified = await pastify(message)
			if (pastified) return message.channel.send({...pastified, flags: 0})
		}
	}]
}

export default PastifyModule
