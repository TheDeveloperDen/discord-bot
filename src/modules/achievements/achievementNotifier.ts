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
import { createStandardEmbed } from "../../util/embeds.js";
import { mentionIfPingable } from "../../util/users.js";
import type {
	AchievementDefinition,
	NotificationMode,
} from "./achievementDefinitions.js";
import { getAchievementProgress } from "./achievementService.js";

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

	const embed = createStandardEmbed(member)
		.setTitle("Achievement Unlocked!")
		.setDescription(
			`${mentionIfPingable(member)} earned **${achievement.name}**!\n> ${achievement.description}`,
		)
		.setThumbnail(member.user.displayAvatarURL({ size: 128 }))
		.setFooter({
			text: `${achievement.category.charAt(0).toUpperCase() + achievement.category.slice(1)} Achievements | ${progress.unlocked}/${progress.total} total`,
		});

	// Use per-achievement override if set, otherwise fall back to global config
	const mode =
		achievement.notificationMode ?? achievementConfig.notificationMode;

	try {
		await sendByMode(
			client,
			member,
			embed,
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
 * Send an embed using the specified notification mode.
 * Centralizes the mode-based routing logic.
 */
async function sendByMode(
	client: Client,
	member: GuildMember,
	embed: ReturnType<typeof createStandardEmbed>,
	mode: NotificationMode,
	achievementConfig: AchievementConfig,
	triggerChannel?: TextBasedChannel,
): Promise<void> {
	switch (mode) {
		case "dm":
			await sendDM(client, member, embed, achievementConfig);
			break;
		case "channel":
			await sendToChannel(client, embed, achievementConfig.notificationChannel);
			break;
		case "trigger":
		default:
			await sendToTriggerLocation(
				client,
				member,
				embed,
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
	embed: ReturnType<typeof createStandardEmbed>,
	achievementConfig: AchievementConfig,
): Promise<void> {
	try {
		await member.send({ embeds: [embed] });
		logger.debug(`Sent achievement DM to ${member.id}`);
	} catch {
		// DM failed (probably blocked), fall back to channel
		logger.debug(`DM failed for ${member.id}, falling back to channel`);
		const fallbackChannelId =
			achievementConfig.fallbackChannel ?? config.channels.botCommands;
		await sendToChannel(client, embed, fallbackChannelId);
	}
}

/**
 * Send notification to a specific channel.
 */
async function sendToChannel(
	client: Client,
	embed: ReturnType<typeof createStandardEmbed>,
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

	await (channel as TextChannel).send({ embeds: [embed] });
	logger.debug(`Sent achievement notification to channel ${channelId}`);
}

/**
 * Send notification to the trigger location with fallbacks.
 */
async function sendToTriggerLocation(
	client: Client,
	member: GuildMember,
	embed: ReturnType<typeof createStandardEmbed>,
	triggerChannel: TextBasedChannel | undefined,
	achievementConfig: AchievementConfig,
): Promise<void> {
	// Try trigger channel first
	if (triggerChannel && "send" in triggerChannel) {
		await triggerChannel.send({ embeds: [embed] });
		logger.debug(`Sent achievement notification to trigger channel`);
		return;
	}

	// Fall back to configured fallback channel
	if (achievementConfig.fallbackChannel) {
		await sendToChannel(client, embed, achievementConfig.fallbackChannel);
		return;
	}

	// Final fallback to botCommands
	await sendToChannel(client, embed, config.channels.botCommands);
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
	if (byMode.size === 1) {
		const [mode, groupedAchievements] = [...byMode.entries()][0];

		// For single achievement, use standard notification
		if (groupedAchievements.length === 1) {
			await notifyAchievementUnlocked(
				client,
				member,
				groupedAchievements[0],
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
		if (groupedAchievements.length === 1) {
			await notifyAchievementUnlocked(
				client,
				member,
				groupedAchievements[0],
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

	const achievementList = achievements
		.map((a) => `${a.emoji} **${a.name}** - ${a.description}`)
		.join("\n");

	const embed = createStandardEmbed(member)
		.setTitle(`${achievements.length} Achievements Unlocked!`)
		.setDescription(
			`${mentionIfPingable(member)} earned:\n\n${achievementList}`,
		)
		.setThumbnail(member.user.displayAvatarURL({ size: 128 }))
		.setFooter({
			text: `${progress.unlocked}/${progress.total} achievements unlocked`,
		});

	try {
		await sendByMode(
			client,
			member,
			embed,
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
