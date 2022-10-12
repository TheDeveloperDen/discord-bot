import {CommandInteraction, GuildMember, User} from 'discord.js'

import {
	APIApplicationCommandOptionChoice
} from 'discord-api-types/payloads/v10/_interactions/_applicationCommands/_chatInput/shared'
import {DDUser} from '../../store/models/DDUser.js'
import {Command} from 'djs-slash-helper'
import {ApplicationCommandOptionType, ApplicationCommandType} from 'discord-api-types/v10'
import {createStandardEmbed} from '../../util/embeds.js'
import {branding} from '../../util/branding.js'
import {actualMention} from '../../util/users.js'
import {getActualDailyStreak} from './dailyReward.command.js'
import {createImage, getCanvasContext} from '../../util/imageUtils.js'
import { drawText } from '../../util/textRendering.js'
import { loadImage } from 'canvas'

interface LeaderboardType extends APIApplicationCommandOptionChoice<string> {
	calculate?: (user: DDUser) => Promise<number>,

	format(value: number): string,

	value: keyof DDUser
}

type LeaderboardData = {
	name: string;
	value: string;
	avatar: string;
}

const info: LeaderboardType[] = [
	{value: 'xp', name: 'XP', format: value => `${value} XP`},
	{value: 'level', name: 'Level', format: value => `Level ${value}`},
	{
		value: 'currentDailyStreak',
		calculate: user => getActualDailyStreak(user),
		name: 'Current Daily Streak',
		format: s => `${formatDays(s)}`
	},
	{
		value: 'highestDailyStreak',
		name: 'Highest Daily Streak',
		format: s => `${formatDays(s)}`
	}
]

export const LeaderboardCommand: Command<ApplicationCommandType.ChatInput> = {
	type: ApplicationCommandType.ChatInput,
	name: 'leaderboard',
	description: 'Show the top 10 users based on XP, Level, or Daily Streak',
	options: [{
		type: ApplicationCommandOptionType.String,
		name: 'type',
		description: 'The type of leaderboard to show',
		required: true,
		choices: info
	}],

	async handle(interaction: CommandInteraction) {
		await interaction.deferReply()
		const guild = interaction.guild
		if (!guild) {
			await interaction.followUp('This command can only be used in a server')
			return
		}
		const option = interaction.options.get('type', true).value as string
		const traitInfo = info.find(it => it.value == option)
		if (!traitInfo) {
			await interaction.followUp('Invalid leaderboard type')
			return
		}
		const {format, value, name} = traitInfo
		const calculate = traitInfo.calculate ?? ((user: DDUser) => Promise.resolve(user[value]))
		const users = await DDUser.findAll({
			order: [[value, 'DESC']],
			limit: 3
		}).then(users => users.filter(async it => await calculate(it) > 0))
		if (users.length == 0) {
			await interaction.followUp('No applicable users')
			return
		}

		const data = await Promise.all(users.map(async (user, index) => {
			const discordUser = await guild.client.users.fetch(user.id.toString()).catch(() => null)
			const value = format(await calculate(user))

			if (discordUser == null) return null

			return {
				name: discordUser.username,
				value: value,
				avatar: discordUser.avatar
			}
		}))

		const member = (interaction.options.getMember('member') ?? interaction.member) as GuildMember
		const image = await createLeaderboardImage(traitInfo, data as LeaderboardData[])

		await interaction.followUp({
			embeds: [
				createStandardEmbed(member)
					.setTitle(`${branding.name} Leaderboard`)
					.setImage('attachment://leaderboard.png')
			],
			files: [{ attachment: image.toBuffer(), name: 'leaderboard.png' }]
		})
	}
}

const defaultDiscordLogo = 'https://i.imgur.com/sxS0Due.png'

async function createLeaderboardImage(type: LeaderboardType, [first, second, third]: LeaderboardData[]) {
	const [canvas, ctx] = getCanvasContext(1000, 500)

	const goldAvatar = await loadImage(first.avatar ?? defaultDiscordLogo)

	ctx.drawImage(await loadImage('leaderboardBackground.png'))
	ctx.drawImage(goldAvatar, 43, 142, 85, 85)

	return canvas
}

function formatDays(days: number) {
	if (days == 1) {
		return '1 day'
	}
	return `${days} days`
}

