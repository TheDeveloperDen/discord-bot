import Module from '../module.js'
import HotTakeCommand from './hotTake.command.js'
import HotTakeListener from './hotTakes.listener.js'
import ManyHotTakesCommand from './manyHotTakes.command.js'

export const HotTakesModule: Module = {
    name: 'hotTakes',
    commands: [HotTakeCommand, ManyHotTakesCommand],
    listeners: [HotTakeListener]
}
