import Module from '../module.js'
import HotTakeCommand from './hotTake.command.js'
import HotTakeListener from './hotTakes.listener.js'

export const HotTakesModule: Module = {
	name: 'hotTakes',
	commands: [HotTakeCommand],
	listeners: [HotTakeListener]
}
