import {CommandInteraction, GuildMember} from 'discord.js'
import {Command} from 'djs-slash-helper'
import {ApplicationCommandType} from 'discord-api-types/v10'
import {logger} from '../../logging.js'
import {DDUser, getUserById} from '../../store/models/DDUser.js'
import {createStandardEmbed} from '../../util/embeds.js'
import {giveXp} from './xpForMessage.util.js'

export const DailyRewardCommand: Command<ApplicationCommandType.ChatInput> = {
	name: 'daily',
	description: 'Claim your daily reward',
	type: ApplicationCommandType.ChatInput,
	options: [],

	async handle(interaction: CommandInteraction) {
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

		ddUser.currentDailyStreak = await getActualDailyStreak(ddUser) + 1
		if (ddUser.currentDailyStreak > ddUser.highestDailyStreak) {
			ddUser.highestDailyStreak = ddUser.currentDailyStreak
		}

		const xpToGive = Math.min(50 + 20 * (ddUser.currentDailyStreak - 1), 1000)
		const {xpGiven, multiplier} = await giveXp(user, xpToGive)
		ddUser.lastDailyTime = new Date()
		await ddUser.save()

		await interaction.followUp({
			ephemeral: false,
			embeds: [
				createStandardEmbed(user)
					.setTitle('Daily Reward Claimed!')
					.setDescription(`📆 Current Streak = ${formatDayCount(ddUser.currentDailyStreak)}
⭐️ + ${xpGiven} XP  ${multiplier ? `(x${multiplier})` : ''}
⏰ Come back in 24 hours for a new reward!`)
			]
		})
	}
}

export function formatDayCount(count: number) {
	if (count === 1) {
		return '1 day'
	}
	return `${count} days`
}


/**
 * Gets a user's current daily streak, resetting it to 0 if they haven't used it in 24 hours
 * @param ddUser The user to get the streak for
 */
export async function getActualDailyStreak(ddUser: DDUser): Promise<number> {
	const difference = new Date().getTime() - (ddUser.lastDailyTime?.getTime() ?? 0)
	if (difference >= 1000 * 60 * 60 * 24 * 2) {
		// Set streak to 0
		ddUser.currentDailyStreak = 0
	}

	return ddUser.currentDailyStreak
}