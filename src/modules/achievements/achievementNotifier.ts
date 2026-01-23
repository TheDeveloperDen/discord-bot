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
import { fakeMention } from "../../util/users.js";
import type { AchievementDefinition } from "./achievementDefinitions.js";
import { getAchievementProgress } from "./achievementService.js";

type NotificationMode = "channel" | "dm" | "trigger";

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
			`${fakeMention(member.user)} earned **${achievement.name}**!\n> ${achievement.description}`,
		)
		.setThumbnail(member.user.displayAvatarURL({ size: 128 }))
		.setFooter({
			text: `${achievement.category.charAt(0).toUpperCase() + achievement.category.slice(1)} Achievements | ${progress.unlocked}/${progress.total} total`,
		});

	try {
		switch (achievementConfig.notificationMode) {
			case "dm":
				await sendDM(client, member, embed, achievementConfig);
				break;
			case "channel":
				await sendToChannel(
					client,
					embed,
					achievementConfig.notificationChannel,
				);
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
	} catch (error) {
		logger.error(
			`Failed to send achievement notification for ${achievement.name} to ${member.id}:`,
			error,
		);
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
 * Notify multiple achievements at once (batches into single message).
 */
export async function notifyMultipleAchievements(
	client: Client,
	member: GuildMember,
	achievements: AchievementDefinition[],
	triggerChannel?: TextBasedChannel,
): Promise<void> {
	if (achievements.length === 0) return;

	// For single achievement, use standard notification
	if (achievements.length === 1) {
		await notifyAchievementUnlocked(
			client,
			member,
			achievements[0],
			triggerChannel,
		);
		return;
	}

	// For multiple achievements, create a combined embed
	const achievementConfig = getAchievementConfig();
	const progress = await getAchievementProgress(BigInt(member.id));

	const achievementList = achievements
		.map((a) => `${a.emoji} **${a.name}** - ${a.description}`)
		.join("\n");

	const embed = createStandardEmbed(member)
		.setTitle(`${achievements.length} Achievements Unlocked!`)
		.setDescription(`${fakeMention(member.user)} earned:\n\n${achievementList}`)
		.setThumbnail(member.user.displayAvatarURL({ size: 128 }))
		.setFooter({
			text: `${progress.unlocked}/${progress.total} achievements unlocked`,
		});

	try {
		switch (achievementConfig.notificationMode) {
			case "dm":
				await sendDM(client, member, embed, achievementConfig);
				break;
			case "channel":
				await sendToChannel(
					client,
					embed,
					achievementConfig.notificationChannel,
				);
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
	} catch (error) {
		logger.error(
			`Failed to send multiple achievement notifications to ${member.id}:`,
			error,
		);
	}
}
