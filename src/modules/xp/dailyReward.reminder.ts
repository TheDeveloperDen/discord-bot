import { Op } from "@sequelize/core";
import type { Client, GuildMember } from "discord.js";
import { type Job, scheduleJob } from "node-schedule";
import { config } from "../../Config.js";
import { logger } from "../../logging.js";
import { DDUser, getOrCreateUserById } from "../../store/models/DDUser.js";
import { actualMention, isSpecialUser } from "../../util/users.js";
import {
	getActualDailyStreak,
	getNextDailyTime,
} from "./dailyReward.command.js";

const FORTY_EIGHT_HOURS_IN_MS = 48 * 60 * 60 * 1000;

const sendReminder = async (client: Client, user: GuildMember) => {
	const botCommands = await client.channels.fetch(config.channels.botCommands);

	if (!botCommands || !botCommands?.isSendable()) {
		logger.error("Bot commands channel not found or not sendable");
		return;
	}
	// if it's been more than _48_ hours (i.e. we've sent at least 1 reminder and they've ignored it, we stop reminding them)
	const ddUser = await getOrCreateUserById(BigInt(user.id));
	const lastClaimTime = ddUser.lastDailyTime;
	if (!lastClaimTime) {
		logger.error("lastClaimTime is null");
		return;
	}
	if (Date.now() - lastClaimTime.getTime() > FORTY_EIGHT_HOURS_IN_MS) {
		logger.info(
			`User ${user.user.tag} has not claimed their daily in over 48 hours, not reminding them and cancelling future reminders`,
		);
		scheduledReminders.get(ddUser.id)?.cancel();
		scheduledReminders.delete(ddUser.id);
		return;
	}
	await botCommands.send({
		content: `${actualMention(
			user,
		)}, your daily reward is ready to be claimed! </daily:${config.commands.daily}>`,
	});
};

// Schedules a daily reminder, assuming they have permission to get reminders
// If they already have a reminder set, this will replace it to keep the time up to date
export const scheduleReminder = async (
	client: Client,
	user: GuildMember,
	ddUser: DDUser,
) => {
	if (scheduledReminders.has(ddUser.id)) {
		logger.info(
			`Reminder already scheduled for ${user.user.tag}, replacing...`,
		);
		scheduledReminders.get(ddUser.id)?.cancel();
		scheduledReminders.delete(ddUser.id);
	}
	const time = ddUser.lastDailyTime;
	if (!time) {
		logger.info(`User ${user.user.tag} hasn't claimed their first daily yet`);
		return; // don't wanna harass people who haven't claimed their first daily yet
	}

	const actual = await getActualDailyStreak(ddUser);
	if (actual <= 0) {
		logger.info(`User ${user.user.tag} has no streak, not scheduling reminder`);
		return;
	}

	// if they can claim their daily now, remind immediately
	const nextTime = getNextDailyTime(ddUser);
	if (nextTime && nextTime <= new Date()) {
		await sendReminder(client, user);
		return;
	}

	// This will not be perfectly accurate, and if we ever scale to multiple instances of the bot, we'll need to
	// use a more robust system to avoid duplicate reminders.
	const job = scheduleJob(
		{
			hour: time.getHours(),
			minute: time.getMinutes(),
			second: time.getSeconds(),
		},
		async () => {
			await sendReminder(client, user);
		},
	);
	scheduledReminders.set(ddUser.id, job);
	logger.info(
		`Scheduled reminder for ${user.user.tag} at ${job.nextInvocation()?.toLocaleString()}`,
	);
};

export const scheduleAllReminders = async (client: Client) => {
	const usersWithDaily = await DDUser.findAll({
		where: {
			lastDailyTime: {
				[Op.not]: null,
			},
		},
	});

	logger.debug(`Scheduling reminders for ${usersWithDaily.length} members`);

	const guild = await client.guilds.fetch(config.guildId);
	for (const ddUser of usersWithDaily) {
		const member = await guild.members
			.fetch(ddUser.id.toString())
			.catch(() => null); // if they aren't in the server anymore
		if (!member || !isSpecialUser(member)) {
			continue;
		}
		await scheduleReminder(client, member, ddUser);
	}
};

export const scheduledReminders = new Map<bigint, Job>();
