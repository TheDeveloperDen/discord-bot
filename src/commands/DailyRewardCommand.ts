import {Command} from './Commands.js'
import {SlashCommandBuilder} from '@discordjs/builders'
import {CommandInteraction, GuildMember} from 'discord.js'
import {getUserById} from '../store/models/DDUser.js'
import {createStandardEmbed} from '../util/embeds.js'
import {logger} from '../logging.js'

export const DailyRewardCommand: Command = {
	info: new SlashCommandBuilder()
		.setName('daily')
		.setDescription('Claim your daily reward'),

	async execute(interaction: CommandInteraction) {
		const user = interaction.member as GuildMember
		if (!user) {
			await interaction.reply('You must be in a guild to use this command')
			return
		}
		await interaction.deferReply()
		const ddUser = await getUserById(BigInt(user.id))
		const difference = new Date().getTime() - (ddUser.lastDailyTime?.getTime() ?? 0)
		if (difference < 1000 * 60 * 60 * 24) {
			const lastClaimTime = ddUser.lastDailyTime
			if (!lastClaimTime) {
				logger.error('lastClaimTime is null')
				return
			}
			const nextClaimTime = new Date(lastClaimTime.getTime() + 1000 * 60 * 60 * 24)
			await interaction.followUp({
				ephemeral: true,
				content: `You can only claim your daily reward once every 24 hours. You can claim it again <t:${nextClaimTime.getTime() / 1000}:R>.`
			})
			return
		}
		if (difference >= 1000 * 60 * 60 * 24 * 2) {
			// Set streak to 0
			ddUser.currentDailyStreak = 0
		}
		ddUser.currentDailyStreak++
		if (ddUser.currentDailyStreak > ddUser.highestDailyStreak) {
			ddUser.highestDailyStreak = ddUser.currentDailyStreak
		}

		const xpToGive = Math.min(50 + 20 * (ddUser.currentDailyStreak - 1), 1000)
		ddUser.xp += xpToGive
		ddUser.lastDailyTime = new Date()
		await ddUser.save()

		await interaction.followUp({
			ephemeral: false,
			embeds: [
				{
					...createStandardEmbed(user),
					title: 'Daily Reward Claimed!',
					description:
						`📆 Current Streak = ${formatDayCount(ddUser.currentDailyStreak)}
⭐️ + ${xpToGive} XP
⏰ Come back in 24 hours for a new reward!`
				},
			]
		})
	}
}

export const formatDayCount = (count: number) => {
	if (count === 1) {
		return '1 day'
	}
	return `${count} days`
}