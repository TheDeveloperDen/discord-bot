import {Command} from './Commands'
import {SlashCommandBuilder} from '@discordjs/builders'
import {
	ApplicationCommand,
	ApplicationCommandPermissionData,
	ColorResolvable,
	CommandInteraction,
	GuildMember
} from 'discord.js'
import {config} from '../Config'
import {ColourRoles} from '../store/models/ColourRoles'

export const ColourRoleCommand: Command = {
	info: new SlashCommandBuilder()
		.setName('rolecolour')
		.setDescription('Set your role colour')
		.setDefaultPermission(false)
		.addStringOption(option => option
			.setName('colour')
			.setDescription('The colour to set as a hex string')
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

		const colour = interaction.options.getString('colour', true)
		if (!colour.startsWith('#') || colour.length !== 7) {
			await interaction.reply({content: 'Not a valid colour', ephemeral: true})
			return
		}

		await interaction.deferReply({ephemeral: true})

		const user = interaction.user
		const member = interaction.member as GuildMember
		const colourRole = await ColourRoles.findOne({
			where: {
				id: user.id
			}
		})

		let role
		if (colourRole) {
			role = await member.roles.cache.find((a, id) => id == colourRole?.colourRole.toString())
			await role?.setColor(colour as ColorResolvable)
		}

		if (!role) {
			const position = interaction.guild?.roles.cache.find(role => role.id == config.roles.admin)?.position || 0

			role = await member.guild.roles.create({
				color: colour as ColorResolvable,
				permissions: [],
				name: member.displayName,
				position: position + 1
			})
			await ColourRoles.upsert({
				id: BigInt(user.id),
				colourRole: BigInt(role.id)
			})
		}

		await member.roles.add(role)

		await interaction.editReply({
			content: `Set your colour to ${colour}`,
		})
	}
}
