import {Client, GuildMember, TextChannel} from 'discord.js'
import {logger} from '../../logging.js'
import {DDUser, getUserById} from '../../store/models/DDUser.js'
import {config} from '../../Config.js'
import {isSpecialUser, mention} from '../../util/users.js'
import {scheduleJob} from 'node-schedule'

const sendReminder = async (client: Client, user: GuildMember) => {
	const botCommands = await client.channels.fetch(config.channels.botCommands)
	if (!(botCommands instanceof TextChannel)) {
		logger.error('Bot commands channel not found')
		return
	}
	await botCommands.send({
		content: `${mention(user)}, your daily reward is ready to be claimed! </daily:${config.commands.daily}>`,
	})
}

// Schedules a daily reminder, if one isn't already scheduled, assuming they have permission to get reminders
export const scheduleReminder = async (client: Client, user: GuildMember, ddUser: DDUser) => {
	logger.info(`Scheduling reminder for ${user.user.tag}`)
	if (scheduledReminders.has(ddUser.id)) {
		logger.info(`Reminder already scheduled for ${user.user.tag}`)
		return
	}
	const time = ddUser.lastDailyTime
	if (!time) {
		logger.info(`User ${user.user.tag} hasn't claimed their first daily yet`)
		return // don't wanna harass people who haven't claimed their first daily yet
	}

	scheduleJob({hour: time.getHours(), minute: time.getMinutes(), second: time.getSeconds()}, async () => {
		await sendReminder(client, user)
	})
	scheduledReminders.add(ddUser.id)
	logger.info(`Scheduled reminder for ${user.user.tag}`)
}

export const scheduleAllReminders = async (client: Client) => {
	const guild = await client.guilds.fetch(config.guildId)
	const list = await guild.members.list()
	await Promise.all(
		Array.from(list.values())
			.filter(isSpecialUser)
			.map(async (member) => {
					const ddUser = await getUserById(BigInt(member.id))
					await scheduleReminder(client, member, ddUser)
				}
			))
}

const scheduledReminders = new Set<bigint>()