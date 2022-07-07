import Module from '../module.js'
import hotTakeCommand from './hotTake.command.js'

export const HotTakesModule: Module = {
	name: 'hotTakes',
	commands: [hotTakeCommand]
}
