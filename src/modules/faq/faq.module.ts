import Module from '../module.js'
import { FaqCommandListener } from './faqCommand.listener.js'
import { FaqCommand } from './faq.command.js'

export const FaqModule: Module = {
  name: 'faq',
  commands: [FaqCommand],
  listeners: [FaqCommandListener]
}

export default FaqModule
