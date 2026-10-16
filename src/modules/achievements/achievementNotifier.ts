/**
 * Achievement Notifier
 *
 * Handles sending notifications when achievements are unlocked.
 * Supports multiple notification modes: channel, DM, or trigger location.
 */

import type {
	Client,
	GuildMember,
	TextBasedChannel,
	TextChannel,
} from "discord.js";
import { config } from "../../Config.js";
import { logger } from "../../logging.js";
import type {
	AchievementDefinition,
	NotificationMode,
} from "./achievementDefinitions.js";
import { getAchievementProgress } from "./achievementService.js";
import {
	renderAchievementsUnlocked,
	renderAchievementUnlocked,
} from "./achievements.cards.js";

type Notification = ReturnType<typeof renderAchievementUnlocked>;

interface AchievementConfig {
	notificationMode: NotificationMode;
	notificationChannel?: string;
	fallbackChannel?: string;
}

function getAchievementConfig(): AchievementConfig {
	return (
		(config as { achievements?: AchievementConfig }).achievements ?? {
			notificationMode: "trigger",
			fallbackChannel: config.channels.botCommands,
		}
	);
}

/**
 * Send a notification when a user unlocks an achievement.
 *
 * @param client Discord client
 * @param member The guild member who earned the achievement
 * @param achievement The achievement definition
 * @param triggerChannel Optional channel where the achievement was triggered
 */
export async function notifyAchievementUnlocked(
	client: Client,
	member: GuildMember,
	achievement: AchievementDefinition,
	triggerChannel?: TextBasedChannel,
): Promise<void> {
	const achievementConfig = getAchievementConfig();
	const progress = await getAchievementProgress(BigInt(member.id));

	const notification = renderAchievementUnlocked(member, achievement, progress);

	// Use per-achievement override if set, otherwise fall back to global config
	const mode =
		achievement.notificationMode ?? achievementConfig.notificationMode;

	try {
		await sendByMode(
			client,
			member,
			notification,
			mode,
			achievementConfig,
			triggerChannel,
		);
	} catch (error) {
		logger.error(
			`Failed to send achievement notification for ${achievement.name} to ${member.id}:`,
			error,
		);
	}
}

/**
 * Send a notification using the specified notification mode.
 * Centralizes the mode-based routing logic.
 */
async function sendByMode(
	client: Client,
	member: GuildMember,
	notification: Notification,
	mode: NotificationMode,
	achievementConfig: AchievementConfig,
	triggerChannel?: TextBasedChannel,
): Promise<void> {
	switch (mode) {
		case "dm":
			await sendDM(client, member, notification, achievementConfig);
			break;
		case "channel":
			await sendToChannel(
				client,
				notification,
				achievementConfig.notificationChannel,
			);
			break;
		case "trigger":
			await sendToTriggerLocation(
				client,
				notification,
				triggerChannel,
				achievementConfig,
			);
			break;
	}
}

/**
 * Send notification as DM with fallback to channel.
 */
async function sendDM(
	client: Client,
	member: GuildMember,
	notification: Notification,
	achievementConfig: AchievementConfig,
): Promise<void> {
	try {
		await member.send(notification);
		logger.debug(`Sent achievement DM to ${member.id}`);
	} catch {
		// DM failed (probably blocked), fall back to channel
		logger.debug(`DM failed for ${member.id}, falling back to channel`);
		const fallbackChannelId =
			achievementConfig.fallbackChannel ?? config.channels.botCommands;
		await sendToChannel(client, notification, fallbackChannelId);
	}
}

/**
 * Send notification to a specific channel.
 */
async function sendToChannel(
	client: Client,
	notification: Notification,
	channelId?: string,
): Promise<void> {
	if (!channelId) {
		logger.warn("No channel ID provided for achievement notification");
		return;
	}

	const channel = await client.channels.fetch(channelId);
	if (!channel?.isTextBased()) {
		logger.warn(`Channel ${channelId} is not a text channel`);
		return;
	}

	await (channel as TextChannel).send(notification);
	logger.debug(`Sent achievement notification to channel ${channelId}`);
}

/**
 * Send notification to the trigger location with fallbacks.
 */
async function sendToTriggerLocation(
	client: Client,
	notification: Notification,
	triggerChannel: TextBasedChannel | undefined,
	achievementConfig: AchievementConfig,
): Promise<void> {
	// Try trigger channel first
	if (triggerChannel && "send" in triggerChannel) {
		await triggerChannel.send(notification);
		logger.debug(`Sent achievement notification to trigger channel`);
		return;
	}

	// Fall back to configured fallback channel
	if (achievementConfig.fallbackChannel) {
		await sendToChannel(
			client,
			notification,
			achievementConfig.fallbackChannel,
		);
		return;
	}

	// Final fallback to botCommands
	await sendToChannel(client, notification, config.channels.botCommands);
}

/**
 * Notify multiple achievements at once.
 * Groups achievements by their notification mode and sends each group appropriately.
 */
export async function notifyMultipleAchievements(
	client: Client,
	member: GuildMember,
	achievements: AchievementDefinition[],
	triggerChannel?: TextBasedChannel,
): Promise<void> {
	if (achievements.length === 0) return;

	const achievementConfig = getAchievementConfig();

	// Group achievements by their effective notification mode
	const byMode = new Map<NotificationMode, AchievementDefinition[]>();
	for (const achievement of achievements) {
		const mode =
			achievement.notificationMode ?? achievementConfig.notificationMode;
		const group = byMode.get(mode) ?? [];
		group.push(achievement);
		byMode.set(mode, group);
	}

	// If all achievements have the same mode, batch them together
	const [onlyGroup, ...otherGroups] = byMode;
	if (onlyGroup && otherGroups.length === 0) {
		const [mode, groupedAchievements] = onlyGroup;

		// For single achievement, use standard notification
		const [onlyAchievement, ...otherAchievements] = groupedAchievements;
		if (onlyAchievement && otherAchievements.length === 0) {
			await notifyAchievementUnlocked(
				client,
				member,
				onlyAchievement,
				triggerChannel,
			);
			return;
		}

		// For multiple achievements with same mode, create combined embed
		await sendAchievementGroup(
			client,
			member,
			groupedAchievements,
			mode,
			achievementConfig,
			triggerChannel,
		);
		return;
	}

	// For achievements with different modes, send each group separately
	for (const [mode, groupedAchievements] of byMode) {
		const [onlyAchievement, ...otherAchievements] = groupedAchievements;
		if (onlyAchievement && otherAchievements.length === 0) {
			await notifyAchievementUnlocked(
				client,
				member,
				onlyAchievement,
				triggerChannel,
			);
		} else {
			await sendAchievementGroup(
				client,
				member,
				groupedAchievements,
				mode,
				achievementConfig,
				triggerChannel,
			);
		}
	}
}

/**
 * Send a group of achievements with a specific notification mode.
 */
async function sendAchievementGroup(
	client: Client,
	member: GuildMember,
	achievements: AchievementDefinition[],
	mode: NotificationMode,
	achievementConfig: AchievementConfig,
	triggerChannel?: TextBasedChannel,
): Promise<void> {
	const progress = await getAchievementProgress(BigInt(member.id));

	const notification = renderAchievementsUnlocked(
		member,
		achievements,
		progress,
	);

	try {
		await sendByMode(
			client,
			member,
			notification,
			mode,
			achievementConfig,
			triggerChannel,
		);
	} catch (error) {
		logger.error(
			`Failed to send achievement group notifications to ${member.id}:`,
			error,
		);
	}
}
