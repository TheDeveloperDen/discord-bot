import Module from '../module.js'
import {FaqCommandListener} from './faqCommand.listener.js'
import {FaqCommand, updateChoices} from './faq.command.js'

export const FaqModule: Module = {
    name: 'faq',
    commands: [FaqCommand],
    listeners: [FaqCommandListener],
    onCommandInit: updateChoices,
    onInit: async (manager,) => {
        await manager.refreshCommands()
    }
}

export default FaqModule
