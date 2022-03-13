import {Command} from './Commands.js'
import {ApplicationCommandPermissionData, Message, MessageContextMenuInteraction} from 'discord.js'
import {ContextMenuCommandBuilder} from '@discordjs/builders'
import {config} from '../Config.js'
import {pastify} from '../util/pastify.js'

export const PastifyCommand: Command<MessageContextMenuInteraction> = {

	info: new ContextMenuCommandBuilder()
		.setName('pastify')
		.setType(3)
		.setDefaultPermission(false),

	async init(command) {
		const permission: ApplicationCommandPermissionData = {
			id: config.roles.staff,
			type: 'ROLE',
			permission: true
		}
		await command.permissions.add({permissions: [permission]})
	},


	async execute(interaction) {
		const message = interaction.options.data[0].message
		await interaction.reply(await pastify(message as Message, true, 10))
	}
}