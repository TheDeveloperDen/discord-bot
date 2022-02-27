import {Command} from './Commands.js'
import {ApplicationCommand, ApplicationCommandPermissionData, CommandInteraction, GuildMember} from 'discord.js'
import {SlashCommandBuilder} from '@discordjs/builders'
import {config} from '../Config'
import {parseTimespan} from '../util/timespan'
import {createStandardEmbed} from '../util/embeds'

export const TimeoutCommand: Command = {
	info: new SlashCommandBuilder()
		.setName('timeout')
		.setDefaultPermission(false)
		.setDescription('Times out a user')
		.addUserOption(option => option
			.setName('target')
			.setDescription('The user to timeout')
			.setRequired(true))
		.addStringOption(option => option
			.setName('duration')
			.setDescription('How long to time out the user for')
			.setRequired(true)
		)
		.addStringOption(option => option
			.setName('reason')
			.setDescription('The reason for issuing the timeout')
			.setRequired(true)),

	async init(command: ApplicationCommand) {
		const permissions = [{
			id: config.roles.staff,
			type: 'ROLE',
			permission: true
		} as ApplicationCommandPermissionData]

		await command.permissions.add({permissions})
	},
	async execute(interaction: CommandInteraction) {
		// capped at 28 days
		const period = Math.min(parseTimespan(interaction.options.getString('duration', true)), 2.419e+9)

		if (period == 0) {
			await interaction.reply('Invalid timespan')
		}

		const user = interaction.options.getMember('target') as GuildMember
		const reason = interaction.options.getString('reason', true)

		await user.timeout(period, reason)
		await interaction.reply({
			embeds: [
				{
					...createStandardEmbed(user),
					title: 'User timed out',
					description: `<@${user.id}>`,
					fields: [
						{
							name: 'Timed out until',
							value: new Date(Date.now() + period).toLocaleString()
						},
						{
							name: 'Reason',
							value: reason
						}
					]
				}
			]
		})
	}

}