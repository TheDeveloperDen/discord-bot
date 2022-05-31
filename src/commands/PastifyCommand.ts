import {Command} from './Commands.js'
import {Message, MessageContextMenuInteraction} from 'discord.js'
import {ContextMenuCommandBuilder} from '@discordjs/builders'
import {pastify} from '../util/pastify.js'

export const PastifyCommand: Command<MessageContextMenuInteraction> = {

	info: new ContextMenuCommandBuilder()
		.setName('pastify')
		.setType(3)
		.setDefaultPermission(false),


	async execute(interaction) {
		const message = interaction.options.data[0].message
		const options = await pastify(message as Message, true, 10)
		await interaction.reply(options)
	}
}