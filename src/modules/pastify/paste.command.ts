import {CommandInteraction} from 'discord.js'
import {config} from '../../Config.js'
import {Command} from 'djs-slash-helper'
import {ApplicationCommandType} from 'discord-api-types/v10'

export const PasteCommand: Command<ApplicationCommandType.ChatInput> = {
    name: 'paste',
    description: 'Show the paste link',
    type: ApplicationCommandType.ChatInput,
    options: [],

    handle: async (interaction: CommandInteraction) =>
        await interaction.reply(
            config.pastebin.url
        )
}
