import {SlashCommandBuilder} from '@discordjs/builders'
import {CommandInteraction, GuildMember} from 'discord.js'
import {Command} from './Commands.js'
import {createStandardEmbed} from '../util/embeds.js'
import {DDUser} from '../store/models/DDUser.js'
import {branding} from '../util/branding.js'
import {actualMention} from '../util/users'

export const LeaderboardCommand: Command = {
	info: new SlashCommandBuilder()
		.setName('leaderboard')
		.setDescription('Show the top 10 users based on XP, Level, or Disboard Bumps')
		.addStringOption(option => option
			.setName('type')
			.setDescription('The type of leaderboard to show')
			.setRequired(true)
			.addChoices([['xp', 'xp'], ['bumps', 'bumps'], ['level', 'level']])),


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
		const traitInfo = info.get(option)
		if (!traitInfo) {
			await interaction.reply('Invalid leaderboard type')
			return
		}
		const [getter, formatter, name] = traitInfo
		const embed = {
			...createStandardEmbed(interaction.member as GuildMember),
			title: `${branding.name} Leaderboard`,
			description: `The top 10 users based on ${name}`,
			fields: await Promise.all(users.map(async (user, index) => {
				const discordUser = await guild.client.users.fetch(user.id.toString()).catch(() => null)
				return {
					name: `#${index + 1} - ${formatter(getter(user))}`,
					value: discordUser == null ? 'Unknown User' : actualMention(discordUser)
				}
			}))
		}
		await interaction.followUp({embeds: [embed]})
	}
}

const info: Map<string, [(arg0: DDUser) => number, (value: number) => string, string]> = new Map([
	['xp', [user => user.xp, value => `${value} XP`, 'XP']],
	['bumps', [user => user.bumps, value => `${value} Bumps`, 'Disboard Bumps']],
	['level', [user => user.level, value => `Level ${value}`, 'Level']]
])
