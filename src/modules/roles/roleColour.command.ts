import {Command} from 'djs-slash-helper'
import {ColorResolvable, GuildMember} from 'discord.js'
import {ColourRoles} from '../../store/models/ColourRoles.js'
import {config} from '../../Config.js'
import {ApplicationCommandOptionType, ApplicationCommandType} from 'discord-api-types/v10'
import {logger} from '../../logging.js'

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

	async handle(interaction) {
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
			logger.info(`Updating colour for ${user.username}#${user.discriminator} to ${colour} with role ${colourRole.toJSON()}`)
			role = member.roles.cache.find((_, id) => id == colourRole.colourRole.toString())
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
