import { Command } from 'djs-slash-helper'
import { ApplicationCommandType } from 'discord-api-types/v10'
import { pastify } from './pastify.js'
import { Message } from 'discord.js'

export const PastifyCommand: Command<ApplicationCommandType.Message> = {
  name: 'Pastify',
  default_permission: false,
  type: ApplicationCommandType.Message,
  async handle (interaction) {
    const message = interaction.options.data[0].message
    const options = await pastify(message as Message, true, 10)
    await interaction.reply(options)
  }
}
