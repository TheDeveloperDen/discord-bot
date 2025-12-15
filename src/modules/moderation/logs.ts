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
