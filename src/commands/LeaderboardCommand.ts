import {SlashCommandBuilder} from '@discordjs/builders'
import {CommandInteraction, GuildMember} from 'discord.js'
import {Command} from './Commands.js'
import {createStandardEmbed} from '../util/embeds.js'
import {DDUser} from '../store/models/DDUser.js'
import {branding} from '../util/branding.js'
import {actualMention} from '../util/users.js'
import {
	APIApplicationCommandOptionChoice
} from 'discord-api-types/payloads/v10/_interactions/_applicationCommands/_chatInput/shared'

interface LeaderboardType extends APIApplicationCommandOptionChoice<string> {
	calculate(user: DDUser): number,

	format(value: number): string
}

const info: LeaderboardType[] = [
	{name: 'xp', value: 'XP', calculate: user => user.xp, format: value => `${value} XP`},
	{name: 'bumps', value: 'Disboard Bumps', calculate: user => user.bumps, format: value => `${value} Bumps`},
	{name: 'level', value: 'Level', calculate: user => user.level, format: value => `Level ${value}`}
]

export const LeaderboardCommand: Command = {
	info: new SlashCommandBuilder()
		.setName('leaderboard')
		.setDescription('Show the top 10 users based on XP, Level, or Disboard Bumps')
		.addStringOption(option => option
			.setName('type')
			.setDescription('The type of leaderboard to show')
			.setRequired(true)
			.addChoices(...info)),


	async execute(interaction: CommandInteraction) {
		await interaction.deferReply()
		const guild = interaction.guild
		if (!guild) {
			await interaction.followUp('This command can only be used in a server')
			return
		}
		const option = interaction.options.getString('type', true)
		const users = await DDUser.findAll({
			order: [[option, 'DESC']],
			limit: 10
		})
		const traitInfo = info.find(it => it.value == option)
		if (!traitInfo) {
			await interaction.followUp('Invalid leaderboard type')
			return
		}
		const {calculate, format, name} = traitInfo
		const embed = {
			...createStandardEmbed(interaction.member as GuildMember),
			title: `${branding.name} Leaderboard`,
			description: `The top 10 users based on ${name}`,
			fields: await Promise.all(users.map(async (user, index) => {
				const discordUser = await guild.client.users.fetch(user.id.toString()).catch(() => null)
				return {
					name: `#${index + 1} - ${format(calculate(user))}`,
					value: discordUser == null ? 'Unknown User' : actualMention(discordUser)
				}
			}))
		}
		await interaction.followUp({embeds: [embed]})
	}
}
