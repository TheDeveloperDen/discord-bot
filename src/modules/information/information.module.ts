import Module from '../module.js'
import {EmbedMessageCommand} from './embedMessage.command.js'
import {AddFAQButtonCommand} from './addFAQButton.command.js'

export const InformationModule: Module = {
	name: 'information',
	commands: [EmbedMessageCommand, AddFAQButtonCommand]
}
