import {config} from '../../Config.js'
import {Command} from 'djs-slash-helper'
import {GuildMember} from 'discord.js'
import {ApplicationCommandOptionType, ApplicationCommandType} from 'discord-api-types/v10.js'

const allowedRoles = [
	...config.roles.usersAllowedToSet,
	config.roles.noPing,
	config.roles.bumpNotifications
]

export const RoleCommand: Command<ApplicationCommandType.ChatInput> = {
	name: 'role',
	description: 'Get or remove a role',
	type: ApplicationCommandType.ChatInput,
	options: [{
		type: ApplicationCommandOptionType.Role,
		name: 'role',
		description: 'The role to get',
		required: true,
	}],

	async handle(interaction) {
		const role = interaction.options.getRole('role', true)
		if (!allowedRoles.includes(role.id)) {
			return interaction.reply(`You cannot get or remove this Role. Options: ${allowedRoles.map(r => `<@&${r}>`).join(', ')}`)
		}

		const user = interaction.member as GuildMember
		if (user == null) {
			return interaction.reply('You must be a member of this server to use this command.')
		}
		if (user.roles.cache.has(role.id)) {
			await user.roles.remove(role.id)
			await interaction.reply(`Removed role <@&${role.id}>`)
		} else {
			await user.roles.add(role.id)
			await interaction.reply(`Added role <@&${role.id}>`)
		}
	}

}
