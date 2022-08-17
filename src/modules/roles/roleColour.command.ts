import {Command} from 'djs-slash-helper'
import {ColorResolvable, GuildMember} from 'discord.js'
import {ColourRoles} from '../../store/models/ColourRoles.js'
import {config} from '../../Config.js'
import {ApplicationCommandOptionType, ApplicationCommandType} from 'discord-api-types/v10'

export const RoleColourCommand: Command<ApplicationCommandType.ChatInput> = {
	name: 'rolecolour',
	description: 'Set your role colour',
	type: ApplicationCommandType.ChatInput,
	default_permission: false,
	options: [{
		type: ApplicationCommandOptionType.String,
		name: 'colour',
		description: 'The colour to set as a hex string',
		required: true
	}],

	handle: async function (interaction) {
		const colour = interaction.options.get('colour', true).value as string
		if (!colour.startsWith('#') || colour.length !== 7) {
			await interaction.reply({content: 'Not a valid colour', ephemeral: true})
			return
		}

		await interaction.deferReply({ephemeral: true})
		const user = interaction.user
		const member = interaction.member as GuildMember
		const roleInfo = await ColourRoles.findOne({
			where: {
				id: user.id
			}
		})
		let role
		if (roleInfo) {
			const roleId = roleInfo.getDataValue('role') // no idea why normal property lookup doesnt work
			if (!roleId) {
				throw new Error('No colour role found, database call failed?')
			}
			role = await member.roles.resolve(roleId.toString())
			await role?.setColor(colour as ColorResolvable)
		}

		if (!role) {
			const position = interaction.guild?.roles.resolve(config.roles.separators.general)?.position || 0
			role = await member.guild.roles.create({
				color: colour as ColorResolvable,
				permissions: [],
				name: member.user.username,
				position: position
			})
			await ColourRoles.upsert({
				id: BigInt(user.id),
				role: BigInt(role.id)
			})
		}

		await member.roles.add(role)

		await interaction.editReply({
			content: `Set your colour to ${colour}`,
		})
	}
}
