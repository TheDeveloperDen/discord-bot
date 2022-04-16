import {SlashCommandBuilder} from '@discordjs/builders'
import {CommandInteraction, GuildMember} from 'discord.js'
import {Command} from './Commands.js'
import {createStandardEmbed} from '../util/embeds.js'
import {DDUser} from '../store/models/DDUser.js'
import {branding} from '../util/branding.js'
import {actualMention} from '../util/users.js'

interface LeaderboardType {
	name: string,

	calculate(user: DDUser): number,

	format(value: number): string
}

const info: { [name: string]: LeaderboardType | undefined } = {
	'xp': {name: 'XP', calculate: user => user.xp, format: value => `${value} XP`},
	'bumps': {name: 'Disboard Bumps', calculate: user => user.bumps, format: value => `${value} Bumps`},
	'level': {name: 'Level', calculate: user => user.level, format: value => `Level ${value}`}
}

export const LeaderboardCommand: Command = {
	info: new SlashCommandBuilder()
		.setName('leaderboard')
		.setDescription('Show the top 10 users based on XP, Level, or Disboard Bumps')
		.addStringOption(option => option
			.setName('type')
			.setDescription('The type of leaderboard to show')
			.setRequired(true)
			.addChoices(
				Object.keys(info).map(it => [it, it]))),


	async execute(interaction: CommandInteraction) {
		await interaction.deferReply()
		const guild = interaction.guild
		if (!guild) {
			await interaction.reply('This command can only be used in a server')
			return
		}
		const option = interaction.options.getString('type', true)
		const users = await DDUser.findAll({
			order: [[option, 'DESC']],
			limit: 10
		})
		const traitInfo = info[option]
		if (!traitInfo) {
			await interaction.reply('Invalid leaderboard type')
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