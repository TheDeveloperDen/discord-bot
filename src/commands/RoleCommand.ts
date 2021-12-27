import {SlashCommandBuilder} from '@discordjs/builders'
import {CommandInteraction, GuildMember} from 'discord.js'
import {Command} from './Commands.js'


export class RoleCommand implements Command {
	info = new SlashCommandBuilder()
		.setName('role')
		.setDescription('Get or remove a Role')
		.addRoleOption(option => option
			.setName('role')
			.setDescription('The role to get')
			.setRequired(true))

	allowedRoles = [
		'848197427617595393'
	]

	async execute(interaction: CommandInteraction) {
		const role = interaction.options.getRole('role', true)
		if (!this.allowedRoles.includes(role.id)) {
			await interaction.reply(`You cannot get or remove this Role. Options: ${this.allowedRoles.map(r => `<@&${r}>`).join(', ')}`)
			return
		}

		const user = interaction.member as GuildMember
		if (user == null) {
			await interaction.reply('You must be a member of this server to use this command.')
			return
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