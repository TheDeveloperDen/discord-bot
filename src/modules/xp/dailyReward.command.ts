import { GuildMember } from 'discord.js'
import { Command } from 'djs-slash-helper'
import { ApplicationCommandType } from 'discord-api-types/v10'
import { logger } from '../../logging.js'
import { DDUser, getOrCreateUserById } from '../../store/models/DDUser.js'
import { createStandardEmbed } from '../../util/embeds.js'
import { giveXp } from './xpForMessage.util.js'
import { wrapInTransaction } from '../../sentry.js'
import { scheduleReminder } from './dailyReward.reminder.js'
import { isSpecialUser } from '../../util/users.js'

export const DailyRewardCommand: Command<ApplicationCommandType.ChatInput> = {
  name: 'daily',
  description: 'Claim your daily reward',
  type: ApplicationCommandType.ChatInput,
  options: [],

  handle: wrapInTransaction('daily', async (_, interaction) => {
    const startTime = new Date().getTime()
    const user = interaction.member as GuildMember
    if (!user) {
      await interaction.reply('You must be in a guild to use this command')
      return
    }
    await interaction.deferReply()
    const ddUser = await getOrCreateUserById(BigInt(user.id))
    const difference = new Date().getTime() -
        (ddUser.lastDailyTime?.getTime() ?? 0)
    if (difference < 1000 * 60 * 60 * 24) {
      const lastClaimTime = ddUser.lastDailyTime
      if (lastClaimTime == null) {
        logger.error('lastClaimTime is null')
        return
      }
      const nextClaimTime = new Date(
        lastClaimTime.getTime() + 1000 * 60 * 60 * 24)
      await interaction.followUp({
        ephemeral: true,
        content: `You can only claim your daily reward once every 24 hours. You can claim it again <t:${Math.floor(
            nextClaimTime.getTime() / 1000)}:R>.`
      })
      logger.info(
          `Daily reward attempted by ${user.user.tag} in ${new Date().getTime() -
          startTime}ms`)
      return
    }

    const [, streak] = getActualDailyStreakWithoutSaving(ddUser)
    ddUser.currentDailyStreak = streak + 1

    if (ddUser.currentDailyStreak > ddUser.highestDailyStreak) {
      ddUser.highestDailyStreak = ddUser.currentDailyStreak
    }

    const xpToGive = Math.min(50 + 20 * (ddUser.currentDailyStreak - 1), 1000)
    const {
      xpGiven,
      multiplier
    } = await giveXp(user, xpToGive)
    ddUser.lastDailyTime = new Date()
    await Promise.all(
      [
        interaction.followUp({
          ephemeral: false,
          embeds: [
            createStandardEmbed(user)
              .setTitle('Daily Reward Claimed!')
              .setDescription(
                  `📆 Current Streak = ${formatDayCount(ddUser.currentDailyStreak)}
⭐️ + ${xpGiven} XP  ${multiplier ? `(x${multiplier})` : ''}
⏰ Come back in 24 hours for a new reward!`)
          ]
        }),
        ddUser.save()
      ]
    )
    logger.info(
        `Daily reward claimed by ${user.user.tag} in ${new Date().getTime() -
        startTime}ms`)
    if (isSpecialUser(user)) {
      await scheduleReminder(user.client, user, ddUser)
    }
  }
  )
}

export function formatDayCount (count: number) {
  if (count === 1) {
    return '1 day'
  }
  return `${count} days`
}

/**
 * Gets a user's current daily streak, resetting it to 0 if they haven't used it in 24 hours
 * @param ddUser The user to get the streak for
 */
export async function getActualDailyStreak (ddUser: DDUser): Promise<number> {
  const [reset, streak] = getActualDailyStreakWithoutSaving(ddUser)
  if (reset) {
    await ddUser.save()
  }
  return streak
}

/**
 * Gets a user's current daily streak, resetting it to 0 if they haven't used it in 24 hours.
 * This function will not save the model
 * @param ddUser The user to get the streak for
 */
export function getActualDailyStreakWithoutSaving (ddUser: DDUser): [boolean, number] {
  const difference = new Date().getTime() -
    (ddUser.lastDailyTime?.getTime() ?? 0)
  if (difference >= 1000 * 60 * 60 * 24 * 2) {
    // Set streak to 0
    ddUser.currentDailyStreak = 0
    return [true, ddUser.currentDailyStreak]
  }

  return [false, ddUser.currentDailyStreak]
}
