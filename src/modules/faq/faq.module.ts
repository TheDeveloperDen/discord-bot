import Module from '../module.js'
import {FaqCommandListener} from './faqCommand.listener.js'
import {FaqCommand, updateChoices} from './faq.command.js'
import {moduleManager} from '../../index.js'

export const FaqModule: Module = {
    name: 'faq',
    commands: [FaqCommand],
    listeners: [FaqCommandListener],
    onCommandInit: updateChoices,
    onInit: async () => {
        await moduleManager.refreshCommands()
    }
}

export default FaqModule
