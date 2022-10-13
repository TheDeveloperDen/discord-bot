import {CommandInteraction, GuildMember, User} from 'discord.js'

import {
	APIApplicationCommandOptionChoice
} from 'discord-api-types/payloads/v10/_interactions/_applicationCommands/_chatInput/shared'
import {DDUser} from '../../store/models/DDUser.js'
import {Command} from 'djs-slash-helper'
import {ApplicationCommandOptionType, ApplicationCommandType} from 'discord-api-types/v10'
import {createStandardEmbed} from '../../util/embeds.js'
import {branding} from '../../util/branding.js'
import {getActualDailyStreak} from './dailyReward.command.js'
import {fonts, getCanvasContext} from '../../util/imageUtils.js'
import { drawText } from '../../util/textRendering.js'
import {loadImage} from 'canvas'

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

		const data = await Promise.all(users.map(async (user) => {
			const discordUser = await guild.members.fetch(user.id.toString()).catch(() => null)
			const value = format(await calculate(user))

			if (discordUser == null) return null

			return {
				name: discordUser.displayName,
				value: value,
				avatar: discordUser.displayAvatarURL({ extension: 'png' })
			}
		}))

		const member = (interaction.options.getMember('member') ?? interaction.member) as GuildMember
		const image = await createLeaderboardImage(traitInfo, data as LeaderboardData[])

		await interaction.followUp({
			embeds: [
				createStandardEmbed(member)
					.setTitle(`${branding.name} Leaderboard - ${name}`)
					.setImage('attachment://leaderboard.png')
			],
			files: [{ attachment: image.toBuffer(), name: 'leaderboard.png' }]
		})
	}
}

async function createLeaderboardImage(type: LeaderboardType, [first, second, third]: LeaderboardData[]) {
	const [canvas, ctx] = getCanvasContext(1000, 500)

	const background = await loadImage('static/Pictures/leaderboardBackground.png')
	ctx.drawImage(background, 0, 0)

	const goldAvatar = await loadImage(first.avatar)
	const silverAvatar = await loadImage(second.avatar)
	const bronzeAvatar = await loadImage(third.avatar)

	ctx.drawImage(goldAvatar, 457, 108, 85, 85)
	ctx.drawImage(silverAvatar, 152, 158, 85, 85)
	ctx.drawImage(bronzeAvatar, 762, 208, 85, 85)
	ctx.drawImage(background, 0, 0)

	drawText(ctx, first.value, fonts.montserratSemiBold, {
		x: 405,
		y: 448,
		width: 190,
		height: 40
	}, {
		hAlign: 'center',
		vAlign: 'center',
		maxSize: 70,
		minSize: 1,
		granularity: 3
	})

	drawText(ctx, first.name, fonts.montserratBold, {
		x: 405,
		y: 213,
		width: 190,
		height: 40
	}, {
		hAlign: 'center',
		vAlign: 'center',
		maxSize: 25,
		minSize: 1,
		granularity: 3
	})

	drawText(ctx, second.value, fonts.montserratSemiBold, {
		x: 99,
		y: 448,
		width: 190,
		height: 40
	}, {
		hAlign: 'center',
		vAlign: 'center',
		maxSize: 70,
		minSize: 1,
		granularity: 3
	})

	drawText(ctx, second.name, fonts.montserratBold, {
		x: 99,
		y: 263,
		width: 190,
		height: 40
	}, {
		hAlign: 'center',
		vAlign: 'center',
		maxSize: 25,
		minSize: 1,
		granularity: 3
	})

	drawText(ctx, third.value, fonts.montserratSemiBold, {
		x: 710,
		y: 448,
		width: 190,
		height: 40
	}, {
		hAlign: 'center',
		vAlign: 'center',
		maxSize: 70,
		minSize: 1,
		granularity: 3
	})

	drawText(ctx, third.name, fonts.montserratBold, {
		x: 710,
		y: 312,
		width: 190,
		height: 40
	}, {
		hAlign: 'center',
		vAlign: 'center',
		maxSize: 25,
		minSize: 1,
		granularity: 3
	})


	return canvas
}

function formatDays(days: number) {
	if (days == 1) {
		return '1 day'
	}
	return `${days} days`
}


