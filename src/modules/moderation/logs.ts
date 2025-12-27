import {
	type Client,
	type Colors,
	EmbedBuilder,
	type Snowflake,
	type User,
	type UserResolvable,
} from "discord.js";
import { config } from "../../Config.js";
import { logger } from "../../logging.js";
import { prettyPrintDuration } from "../../util/timespan.js";
import { actualMention, fakeMention } from "../../util/users.js";

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
	| InviteDeletedLog;

interface BanLog {
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

interface SoftBanLog {
	kind: "SoftBan";
	moderator: User;
	target: UserResolvable;
	deleteMessages: boolean;
	reason: string | null;
}
interface TempBanLog {
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
interface KickLog {
	kind: "Kick";
	moderator: User;
	target: UserResolvable;
	reason: string | null;
}

interface InviteDeletedLog {
	kind: "InviteDeleted";
	target: User;
	messageId: Snowflake;
	messageCreatedTimestamp: number;
	edited: boolean;
	matches: string[];
}

type ModerationKindMapping<T> = {
	[f in ModerationLog["kind"]]: T;
};

const embedTitles: ModerationKindMapping<string> = {
	Ban: "Member Banned",
	Unban: "Member Unbanned",
	SoftBan: "Member Softbanned",
	InviteDeleted: "Discord Invite Removed",
	TempBan: "Member Tempbanned",
	Kick: "Member Kicked",
	TempBanEnded: "Tempban Expired",
};

const embedColors: ModerationKindMapping<keyof typeof Colors> = {
	Ban: "Red",
	TempBan: "Orange",
	SoftBan: "DarkOrange",
	Kick: "Yellow",
	Unban: "Green",
	TempBanEnded: "DarkGreen",
	InviteDeleted: "Blurple",
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
};

export async function logModerationAction(
	client: Client,
	action: ModerationLog,
) {
	const modLogChannel = await client.channels.fetch(config.channels.modLog);
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

	const targetUser = await client.users.fetch(action.target).catch(() => null);
	let description = `**Offender**: ${targetUser && fakeMention(targetUser)} ${actualMention(action.target)}\n`;
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
	embed.setDescription(description);

	await modLogChannel.send({
		embeds: [embed],
	});
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

	const contentDisplay =
		message.content.slice(0, 1024) || "*[No text content]*";

	const embed = new EmbedBuilder()
		.setTitle("Message Deleted")
		.setColor("Grey")
		.setDescription(
			`**Author**: <@${message.authorId}> (${message.authorTag})\n` +
				`**Channel**: <#${message.channelId}>\n` +
				`**Created**: <t:${Math.round(message.createdTimestamp / 1000)}:R>\n\n` +
				`**Content**:\n${contentDisplay}`,
		)
		.setFooter({ text: `Message ID: ${message.id}` })
		.setTimestamp();

	if (message.attachmentUrls.length > 0) {
		const attachmentList =
			message.attachmentUrls.slice(0, 5).join("\n") +
			(message.attachmentUrls.length > 5
				? `\n... and ${message.attachmentUrls.length - 5} more`
				: "");
		embed.addFields({
			name: "Attachments",
			value: attachmentList,
		});
	}

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

	// Build a summary - truncate if too many
	const maxDisplayed = 10;
	const displayed = messages.slice(0, maxDisplayed);
	const remaining = messages.length - maxDisplayed;

	let messageList = displayed
		.map(
			(m) =>
				`**${m.authorTag}** (<t:${Math.round(m.createdTimestamp / 1000)}:t>): ${m.content.slice(0, 100) || "*[No text]*"}`,
		)
		.join("\n");

	if (remaining > 0) {
		messageList += `\n... and ${remaining} more messages`;
	}

	const embed = new EmbedBuilder()
		.setTitle("Bulk Messages Deleted")
		.setColor("DarkGrey")
		.setDescription(
			`**Channel**: <#${channelId}>\n` +
				`**Count**: ${messages.length} messages\n\n` +
				`**Messages**:\n${messageList.slice(0, 2000)}`,
		)
		.setTimestamp();

	await modLogChannel.send({ embeds: [embed] });
}
