import Module from '../module.js'
import InfoCommand from './info.command.js'
import {TimeoutCommand} from './timeout.command.js'

export const CoreModule: Module = {
	name: 'core',
	commands: [InfoCommand, TimeoutCommand]
}
