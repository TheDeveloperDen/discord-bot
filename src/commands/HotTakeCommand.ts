import {SlashCommandBuilder} from '@discordjs/builders'
import {ApplicationCommand, ApplicationCommandPermissionData, CommandInteraction} from 'discord.js'
import {Command} from './Commands.js'
import {config} from '../Config.js'
import {generateHotTake} from '../hotTakeSender.js';


export const HotTakeCommand: Command = {
	info: new SlashCommandBuilder()
		.setName('hottake')
		.setDefaultPermission(false)
		.setDescription('Summon a hot take from the database.'),

	async init(command: ApplicationCommand) {
		const permissions = [{
			id: config.roles.admin,

			type: 'ROLE',
			permission: true
		} as ApplicationCommandPermissionData]

		await command.permissions.add({permissions})
	},

	async execute(interaction: CommandInteraction) {
		const hotTake = await generateHotTake()
		await interaction.reply(hotTake)
	}
}