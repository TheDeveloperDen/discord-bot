import {
	ApplicationCommandType,
	type GuildMember,
	type Snowflake,
} from "discord.js";
import type { Command } from "djs-slash-helper";

import { logger } from "../../logging.js";
import { wrapInTransaction } from "../../sentry.js";
import { type DDUser, getOrCreateUserById } from "../../store/models/DDUser.js";
import { createStandardEmbed } from "../../util/embeds.js";
import { EPHEMERAL_FLAG } from "../../util/message.js";
import { isSpecialUser } from "../../util/users.js";
import { scheduleReminder } from "./dailyReward.reminder.js";
import { giveXp } from "./xpForMessage.util.js";

const dailiesInProgress = new Set<Snowflake>();

export const DailyRewardCommand: Command<ApplicationCommandType.ChatInput> = {
	name: "daily",
	description: "Claim your daily reward",
	type: ApplicationCommandType.ChatInput,
	options: [],

	handle: wrapInTransaction("daily", async (_, interaction) => {
		const startTime = Date.now();
		const user = interaction.member as GuildMember;
		if (!user) {
			await interaction.reply("You must be in a guild to use this command");
			return;
		}
		await interaction.deferReply();
		if (dailiesInProgress.has(user.id)) {
			await interaction.followUp({
				flags: EPHEMERAL_FLAG,
				content: "You are already claiming your daily reward!",
			});
			return;
		}
		try {
			dailiesInProgress.add(user.id);
			const ddUser = await getOrCreateUserById(BigInt(user.id));
			const difference = Date.now() - (ddUser.lastDailyTime?.getTime() ?? 0);
			if (difference < 1000 * 60 * 60 * 24) {
				const lastClaimTime = ddUser.lastDailyTime;
				if (lastClaimTime == null) {
					logger.error("lastClaimTime is null");
					return;
				}
				const nextClaimTime = getNextDailyTimeFrom(lastClaimTime);
				await interaction.followUp({
					flags: EPHEMERAL_FLAG,
					content: `You can only claim your daily reward once every 24 hours. You can claim it again <t:${Math.floor(
						nextClaimTime.getTime() / 1000,
					)}:R>.`,
				});
				logger.info(
					`Daily reward attempted by ${user.user.tag} in ${Date.now() - startTime}ms`,
				);
				return;
			}

			const [, streak] = getActualDailyStreakWithoutSaving(ddUser);
			ddUser.currentDailyStreak = streak + 1;

			if (ddUser.currentDailyStreak > ddUser.highestDailyStreak) {
				ddUser.highestDailyStreak = ddUser.currentDailyStreak;
			}

			const xpToGive = 50 + 10 * (ddUser.currentDailyStreak - 1);
			const { xpGiven, multiplier } = await giveXp(user, xpToGive);
			ddUser.lastDailyTime = new Date();
			// how many fire emojis to generate, starts at 1 when your streak is over 100 and then increases by 1 for every 50 days
			const streakMul =
				ddUser.currentDailyStreak >= 100
					? Math.floor((ddUser.currentDailyStreak - 100) / 50) + 1
					: 0;
			await Promise.all([
				interaction.followUp({
					flags: EPHEMERAL_FLAG,
					embeds: [
						createStandardEmbed(user)
							.setTitle("Daily Reward Claimed!")
							.setDescription(
								`📆 Current Streak = ${
									formatDayCount(ddUser.currentDailyStreak) +
									" " +
									"🔥".repeat(streakMul)
								}
⭐️ + ${xpGiven} XP  ${multiplier ? `(x${multiplier})` : ""}
⏰ Come back in 24 hours for a new reward!`,
							),
					],
				}),
				ddUser.save(),
			]);
			logger.info(
				`Daily reward claimed by ${user.user.tag} in ${Date.now() - startTime}ms`,
			);
			if (isSpecialUser(user)) {
				await scheduleReminder(user.client, user, ddUser);
			}
		} finally {
			dailiesInProgress.delete(user.id);
		}
	}),
};

export function formatDayCount(count: number) {
	if (count === 1) {
		return "1 day";
	}
	return `${count} days`;
}

/**
 * Gets a user's current daily streak, resetting it to 0 if they haven't used it in 24 hours
 * @param ddUser The user to get the streak for
 */
export async function getActualDailyStreak(ddUser: DDUser): Promise<number> {
	const [reset, streak] = getActualDailyStreakWithoutSaving(ddUser);
	if (reset) {
		await ddUser.save();
	}
	return streak;
}

/**
 * Gets a user's current daily streak, resetting it to 0 if they haven't used it in 48 hours.
 * This function will not save the model
 * @param ddUser The user to get the streak for
 */
export function getActualDailyStreakWithoutSaving(
	ddUser: DDUser,
): [boolean, number] {
	const difference = Date.now() - (ddUser.lastDailyTime?.getTime() ?? 0);
	if (difference >= 1000 * 60 * 60 * 24 * 2) {
		// Set streak to 0
		ddUser.currentDailyStreak = 0;
		return [true, ddUser.currentDailyStreak];
	}

	return [false, ddUser.currentDailyStreak];
}

/**
 * Gets the next time a user can claim their daily reward, or undefined if they have never claimed it before
 * @param user The user to get the next time for or the last time they claimed it
 */
export function getNextDailyTime(user: DDUser): Date | undefined {
	const lastClaimTime = user.lastDailyTime;
	if (!lastClaimTime) {
		return;
	}
	return getNextDailyTimeFrom(lastClaimTime);
}

export function getNextDailyTimeFrom(date: Date): Date {
	return new Date(
		date.getTime() + 1000 * 60 * 60 * 24, // 24 hours after last claim
	);
}
