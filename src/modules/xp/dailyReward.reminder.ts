import {Client, GuildMember} from 'discord.js'
import {logger} from '../../logging.js'
import {DDUser, getOrCreateUserById} from '../../store/models/DDUser.js'
import {config} from '../../Config.js'
import {actualMention, isSpecialUser, mentionIfPingable} from '../../util/users.js'
import {Job, scheduleJob} from 'node-schedule'
import {getActualDailyStreak, getNextDailyTime} from './dailyReward.command.js'

const sendReminder = async (client: Client, user: GuildMember) => {
    const botCommands = await client.channels.fetch(config.channels.botCommands)

    if (!botCommands || !(botCommands?.isSendable())) {
        logger.error('Bot commands channel not found or not sendable')
        return
    }
    // if it's been more than _48_ hours (i.e. we've sent at least 1 reminder and they've ignored it, we stop reminding them)
    const ddUser = await getOrCreateUserById(BigInt(user.id))
    const lastClaimTime = ddUser.lastDailyTime
    if (!lastClaimTime) {
        logger.error('lastClaimTime is null')
        return
    }
    if (new Date().getTime() - lastClaimTime.getTime() > 1000 * 60 * 60 * 48) {
        logger.info(`User ${user.user.tag} has not claimed their daily in over 48 hours, not reminding them and cancelling future reminders`)
        scheduledReminders.get(ddUser.id)?.cancel()
        return
    }
    await botCommands.send({
        content: `${
            actualMention(
                user
            )
        }, your daily reward is ready to be claimed! </daily:${config.commands.daily}>`
    })
}

// Schedules a daily reminder, assuming they have permission to get reminders
// If they already have a reminder set, this will replace it to keep the time up to date
export const scheduleReminder = async (
    client: Client,
    user: GuildMember,
    ddUser: DDUser
) => {
    if (scheduledReminders.has(ddUser.id)) {
        logger.info(`Reminder already scheduled for ${user.user.tag}, replacing...`)
        scheduledReminders.get(ddUser.id)?.cancel()
        scheduledReminders.delete(ddUser.id)
    }
    const time = ddUser.lastDailyTime
    if (time === undefined) {
        logger.info(`User ${user.user.tag} hasn't claimed their first daily yet`)
        return // don't wanna harass people who haven't claimed their first daily yet
    }

    const actual = await getActualDailyStreak(ddUser)
    if (actual <= 0) {
        logger.info(`User ${user.user.tag} has no streak, not scheduling reminder`)
        return
    }

    // if they can claim their daily now, remind immediately
    const nextTime = getNextDailyTime(ddUser)
    if (nextTime && nextTime <= new Date()) {
        await sendReminder(client, user)
        return
    }

    const job = scheduleJob({
        hour: time.getHours(),
        minute: time.getMinutes(),
        second: time.getSeconds()
    }, async () => {
        await sendReminder(client, user)
    })
    scheduledReminders.set(ddUser.id, job)
    logger.info(
        `Scheduled reminder for ${user.user.tag} at ${job.nextInvocation().toLocaleString()}`
    )
}

export const scheduleAllReminders = async (client: Client) => {
    const guild = await client.guilds.fetch(config.guildId)
    const list = await guild.members.fetch()
    logger.debug(`Scheduling reminders for ${list.size} members`)

    for (const member of Array.from(list.values()).filter(isSpecialUser)) {
        const ddUser = await getOrCreateUserById(BigInt(member.id))
        await scheduleReminder(client, member, ddUser)
    }
}

const scheduledReminders = new Map<bigint, Job>()
