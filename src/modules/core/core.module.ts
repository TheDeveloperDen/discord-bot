import Module from '../module.js'
import InfoCommand from './info.command.js'
import TimeoutCommand from './timeout.command.js'
import SetCommand from './set.command.js'
import { PollListener } from './poll.listener.js'
import { BumpListener } from './bump.listener.js'

export const CoreModule: Module = {
  name: 'core',
  commands: [InfoCommand, TimeoutCommand, SetCommand],
  listeners: [PollListener, BumpListener]
}
