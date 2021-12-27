import {SlashCommandBuilder} from '@discordjs/builders'
import {
	ApplicationCommand,
	ApplicationCommandPermissionData,
	CommandInteraction,
	GuildMember,
	Message,
	MessageActionRow,
	MessageButton,
	MessageEmbedOptions
} from 'discord.js'
import {DDUser, getUserById} from '../store/models/DDUser.js'
import {Command} from './Commands.js'
import {createStandardEmbed} from '../util/embeds.js'
import {mention} from '../util/users.js'
import {DiscordColor} from '@api-typings/discord'
import {sentry} from '../util/errors.js'


export class SetCommand implements Command {
	info = new SlashCommandBuilder()
		.setName('set')
		.setDefaultPermission(false)
		.setDescription('Set data for a user')
		.addUserOption(option => option
			.setName('target')
			.setDescription('The user to edit')
			.setRequired(true))
		.addStringOption(option => option
			.setName('field')
			.setDescription('The field to edit')
			.setRequired(true)
			.addChoices([['xp', 'xp'], ['bumps', 'bumps']]))
		.addIntegerOption(option => option
			.setName('value')
			.setDescription('The value to set')
			.setRequired(true))

	async init(command: ApplicationCommand) {
		const permissions = [{
			id: '821814446749646853',
			type: 'ROLE',
			permission: true
		} as ApplicationCommandPermissionData]

		await command.permissions.add({permissions})
	}

	async execute(interaction: CommandInteraction) {
		const target = interaction.options.getMember('target')
		if (!(target instanceof GuildMember)) {
			await interaction.reply('Could not find user')
			return
		}
		const user = await getUserById(BigInt(target.id))

		const option = interaction.options.getString('field', true)
		const getter = getters.get(option)
		const setter = setters.get(option)
		if (!getter || !setter) {
			sentry(new Error(`Unknown field ${option}`))
			return
		}
		const value = interaction.options.getInteger('value', true)

		const embed: MessageEmbedOptions = {
			...createStandardEmbed(target),
			title: 'Confirm',
			description: `Are you sure you want to set ${mention(target)}'s ${option} to ${value}?`,
			fields: [
				{
					name: 'Current Value',
					value: getter(user).toString(),
					inline: true
				},
				{
					name: 'New Value',
					value: value.toString(),
					inline: true
				},
			]
		}
		const buttons = new MessageActionRow()
			.addComponents(new MessageButton()
				.setCustomId('confirm')
				.setStyle('SUCCESS')
				.setLabel('Confirm'),
			new MessageButton()
				.setCustomId('cancel')
				.setStyle('DANGER')
				.setLabel('Cancel'))
		const reply = await interaction.reply({
			embeds: [embed],
			components: [buttons],
			fetchReply: true
		})

		const channel = interaction.channel
		if (!channel) {
			await interaction.reply('You can\'t do this in DMs')
			return
		}
		const collector = await channel.createMessageComponentCollector({
			filter: i => i.isButton() && i.message?.interaction?.id == interaction.id,
			time: 15000,
			maxComponents: 1
		})

		const event = await collector.next
		if (event.customId == 'cancel') {
			await event.reply({ephemeral: true, content: '**Cancelled**'})
		} else if (event.customId == 'confirm') {
			await event.deferReply()
			setter(user, value)
			await user.save()
			await event.followUp({
				ephemeral: true, embeds: [{
					...createStandardEmbed(target),
					title: 'Success',
					color: DiscordColor.Green,
					description: `Set ${mention(target)}'s ${option} to ${value}`
				}]
			})
		}
		await (reply as Message).delete()
	}
}

const getters = new Map([
	['xp', (user: DDUser) => user.xp],
	['bumps', (user: DDUser) => user.bumps]])

const setters = new Map([
	['xp', (user: DDUser, value: number) => user.xp = value],
	['bumps', (user: DDUser, value: number) => user.bumps = value]])