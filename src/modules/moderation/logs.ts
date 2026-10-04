import {
	type Client,
	type Colors,
	EmbedBuilder,
	type MessageCreateOptions,
	type Snowflake,
	type User,
	type UserResolvable,
} from "discord.js";
import { config } from "../../Config.js";
import { logger } from "../../logging.js";
import { runObserved } from "../../observe.js";
import { createStandardEmbed } from "../../util/embeds.js";
import { prettyPrintDuration } from "../../util/timespan.js";
import { actualMention, fakeMention } from "../../util/users.js";
import { upload } from "../pastify/pastify.js";

export interface CachedMessage {
	id: Snowflake;
	content: string;
	authorId: Snowflake;
	authorTag: string;
	channelId: Snowflake;
	createdTimestamp: number;
	attachmentUrls: string[];
}

export type ModerationLog =
	| BanLog
	| UnbanLog
	| TempBanLog
	| TempBanExpiredLog
	| SoftBanLog
	| KickLog
	| TimeoutLog
	| InviteDeletedLog
	| InviteSpamBanLog
	| WarningLog
	| WarningPardonedLog
	| ReputationGrantedLog;

/** actions whose target gets DMed to tell them about the action */
interface Notified {
	dmSent: boolean; // whether the target was successfully DMed about the action
}

interface BanLog extends Notified {
	kind: "Ban";
	moderator: User;
	target: UserResolvable;
	deleteMessages: boolean;
	reason: string | null;
}

interface UnbanLog {
	kind: "Unban";
	moderator: User;
	target: UserResolvable;
	reason: string | null;
}

interface SoftBanLog extends Notified {
	kind: "SoftBan";
	moderator: User;
	target: UserResolvable;
	deleteMessages: boolean;
	reason: string | null;
}
interface TempBanLog extends Notified {
	kind: "TempBan";
	moderator: User;
	target: UserResolvable;
	deleteMessages: boolean;
	banDuration: number;
	reason: string | null;
}

interface TempBanExpiredLog {
	kind: "TempBanEnded";
	target: UserResolvable;
}
interface KickLog extends Notified {
	kind: "Kick";
	moderator: User;
	target: UserResolvable;
	reason: string | null;
}

interface TimeoutLog extends Notified {
	kind: "Timeout";
	moderator: User;
	target: UserResolvable;
	duration: number;
	reason: string;
}

interface InviteDeletedLog {
	kind: "InviteDeleted";
	target: User;
	messageId: Snowflake;
	messageCreatedTimestamp: number;
	edited: boolean;
	matches: string[];
}

interface WarningLog extends Notified {
	kind: "Warning";
	moderator: User;
	target: UserResolvable;
	reason: string;
	severity: number;
	warningId: number;
	warningCount: number;
	expiresAt: Date | null;
}

interface WarningPardonedLog extends Notified {
	kind: "WarningPardoned";
	moderator: User;
	target: UserResolvable;
	warningId: number;
	reason: string;
}

interface ReputationGrantedLog extends Notified {
	kind: "ReputationGranted";
	moderator: User;
	target: UserResolvable;
	eventType: string;
	scoreChange: number;
	newScore: number;
	reason: string;
}

interface InviteSpamBanLog extends Notified {
	kind: "InviteSpamBan";
	target: User;
	violationCount: number;
	channelCount: number;
	violationWindowMs: number;
	triggerReason: "same_channel" | "cross_channel";
}

type ModerationKindMapping<T> = {
	[f in ModerationLog["kind"]]: T;
};

const embedTitles: ModerationKindMapping<string> = {
	Ban: "Member Banned",
	Unban: "Member Unbanned",
	SoftBan: "Member Softbanned",
	InviteDeleted: "Discord Invite Removed",
	InviteSpamBan: "Member Auto-Banned (Invite Spam)",
	TempBan: "Member Tempbanned",
	Kick: "Member Kicked",
	Timeout: "Member Timed Out",
	TempBanEnded: "Tempban Expired",
	Warning: "Member Warned",
	WarningPardoned: "Warning Pardoned",
	ReputationGranted: "Reputation Granted",
};

const embedColors: ModerationKindMapping<keyof typeof Colors> = {
	Ban: "Red",
	TempBan: "Orange",
	SoftBan: "DarkOrange",
	Kick: "Yellow",
	Timeout: "LightGrey",
	Unban: "Green",
	TempBanEnded: "DarkGreen",
	InviteDeleted: "Blurple",
	InviteSpamBan: "DarkRed",
	Warning: "Gold",
	WarningPardoned: "Aqua",
	ReputationGranted: "Green",
};

const SEVERITY_LABELS: Record<number, string> = {
	1: "Minor",
	2: "Moderate",
	3: "Severe",
};

const embedReasons: {
	[K in ModerationLog["kind"]]?: (
		t: Extract<ModerationLog, { kind: K }>,
	) => string;
} = {
	InviteDeleted: (inviteDeleted) =>
		`Message <#${inviteDeleted.messageId}> at <t:${Math.round(
			inviteDeleted.messageCreatedTimestamp / 1000,
		)}> ${inviteDeleted.edited ? "was edited to contain " : "included"} a Discord invite!\n
    **Invites:** ${inviteDeleted.matches.join(", ")}`,

	TempBan: (tempBan) =>
		`**Ban duration**: \`${prettyPrintDuration(tempBan.banDuration)}\``,

	Timeout: (timeout) =>
		`**Timeout duration**: \`${prettyPrintDuration(timeout.duration)}\``,

	Warning: (warning) =>
		`**Severity:** ${SEVERITY_LABELS[warning.severity] || "Unknown"}\n` +
		`**Warning ID:** #${warning.warningId}\n` +
		`**Total Active Warnings:** ${warning.warningCount}\n` +
		(warning.expiresAt
			? `**Expires:** <t:${Math.floor(warning.expiresAt.getTime() / 1000)}:R>`
			: "**Expires:** Never"),

	WarningPardoned: (pardon) =>
		`**Warning ID:** #${pardon.warningId}\n` +
		`**Pardon Reason:** ${pardon.reason}`,

	ReputationGranted: (rep) =>
		`**Type:** ${rep.eventType}\n` +
		`**Score Change:** +${rep.scoreChange}\n` +
		`**New Score:** ${rep.newScore >= 0 ? "+" : ""}${rep.newScore}`,

	InviteSpamBan: (ban) =>
		`**Violations:** ${ban.violationCount} in ${ban.violationWindowMs / 1000}s\n` +
		`**Channels:** ${ban.channelCount}\n` +
		`**Trigger:** ${ban.triggerReason === "same_channel" ? "4+ violations in same channel" : "Violations across 3+ channels"}`,
};

async function sendModerationLog(client: Client, action: ModerationLog) {
	const targetUser = await client.users.fetch(action.target).catch(() => null);
	const modLogChannel = await client.channels
		.fetch(config.channels.modLog)
		.catch(() => null);

	if (!modLogChannel) {
		logger.error(`Moderation log channel does not exist`);
		return;
	}

	if (!modLogChannel.isSendable()) {
		logger.error(`Moderation log channel is not sendable`);
		return;
	}

	const embed = new EmbedBuilder();
	embed.setTitle(embedTitles[action.kind]);
	embed.setColor(embedColors[action.kind]);

	const targetLabel =
		action.kind === "ReputationGranted" ? "Recipient" : "Offender";
	let description = `**${targetLabel}**: ${targetUser && fakeMention(targetUser)} ${actualMention(action.target)}\n`;
	if ("reason" in action && action.reason) {
		description += `**Reason**:  ${action.reason}\n`;
	}
	if ("moderator" in action && action.moderator) {
		description += `**Responsible Moderator**:  ${actualMention(action.moderator)}\n`;
	}

	if ("deleteMessages" in action && action.deleteMessages) {
		description += `**Deleted Messages**: ${action.deleteMessages ? "`Yes`" : "`No`"}\n`;
	}

	const embedReason = embedReasons[action.kind];
	if (embedReason) {
		// biome-ignore lint/suspicious/noExplicitAny: we know it's safe, fixing would be too complicated
		description += embedReason(action as any);
	}
	if ("dmSent" in action) {
		description += `**DM sent**: ${action.dmSent ? "✅" : "❌"}\n`;
	}
	embed.setDescription(description);

	await modLogChannel.send({
		embeds: [embed],
	});
}

function formatMessageForPaste(message: CachedMessage): string {
	const timestamp = new Date(message.createdTimestamp).toISOString();
	const attachments =
		message.attachmentUrls.length > 0
			? `\nAttachments:\n${message.attachmentUrls.map((url) => `  - ${url}`).join("\n")}`
			: "";

	return `Author: ${message.authorTag} (${message.authorId})
Created: ${timestamp}
Message ID: ${message.id}

Content:
${message.content || "[No text content]"}${attachments}`;
}

export async function logDeletedMessage(
	client: Client,
	message: CachedMessage,
) {
	const modLogChannel = await client.channels.fetch(config.channels.modLog);
	if (!modLogChannel?.isSendable()) {
		logger.error("Moderation log channel not sendable");
		return;
	}

	const pasteContent = formatMessageForPaste(message);
	const pasteUrl = await upload({ content: pasteContent });

	const embed = createStandardEmbed(message.authorId)
		.setTitle("Message Deleted")
		.setColor("Grey")
		.setDescription(
			`**Author**: <@${message.authorId}> (${message.authorTag})\n` +
				`**Channel**: <#${message.channelId}>\n` +
				`**Created**: <t:${Math.round(message.createdTimestamp / 1000)}:R>\n\n` +
				`**Content**: [View on Paste](${pasteUrl})`,
		)
		.setFooter({ text: `Message ID: ${message.id}` })
		.setTimestamp();

	await modLogChannel.send({ embeds: [embed] });
}

export async function logBulkDeletedMessages(
	client: Client,
	messages: CachedMessage[],
	channelId: Snowflake,
) {
	const modLogChannel = await client.channels.fetch(config.channels.modLog);
	if (!modLogChannel?.isSendable()) {
		logger.error("Moderation log channel not sendable");
		return;
	}

	// Sort by timestamp
	messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

	// Format all messages for paste
	const pasteContent = messages
		.map((m, i) => {
			const separator = i > 0 ? "\n" + "─".repeat(50) + "\n\n" : "";
			return separator + formatMessageForPaste(m);
		})
		.join("\n");

	const pasteUrl = await upload({ content: pasteContent });

	const embed = new EmbedBuilder()
		.setTitle("Bulk Messages Deleted")
		.setColor("DarkGrey")
		.setDescription(
			`**Channel**: <#${channelId}>\n` +
				`**Count**: ${messages.length} messages\n\n` +
				`**Messages**: [View on Paste](${pasteUrl})`,
		)
		.setTimestamp();

	await modLogChannel.send({ embeds: [embed] });
}

/**
 * DMs the target of a moderation action with a set message
 * Returns false if they couldn't be DMed
 */
export async function dmModerationTarget(
	user: User,
	message: string | MessageCreateOptions,
): Promise<boolean> {
	try {
		await user.send(message);
		return true;
	} catch (error) {
		logger.warn(`Couldn't DM ${user.id} about a moderation action`, error);
		return false;
	}
}

export const DM_FAILED_WARNING =
	"⚠️ The user couldn't be DMed with a reason for the action";

/** Appended to a moderator's reply when the target couldn't be DMed */
export const dmWarning = (dmSent: boolean) =>
	dmSent ? "" : `\n${DM_FAILED_WARNING}`;

/**
 * Never throws: the action has already happened by the time it's logged,
 * so a logging failure must not be reported to the moderator as the action failing.
 */
export async function logModerationAction(
	client: Client,
	action: ModerationLog,
) {
	await runObserved({ op: "event", name: `modLog.${action.kind}` }, () =>
		sendModerationLog(client, action),
	);
}
