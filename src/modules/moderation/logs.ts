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
	| InviteDeletedLog
	| WarningLog
	| WarningPardonedLog
	| ReputationGrantedLog;

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

interface WarningLog {
	kind: "Warning";
	moderator: User;
	target: UserResolvable;
	reason: string;
	severity: number;
	warningId: number;
	warningCount: number;
	expiresAt: Date | null;
}

interface WarningPardonedLog {
	kind: "WarningPardoned";
	moderator: User;
	target: UserResolvable;
	warningId: number;
	reason: string;
}

interface ReputationGrantedLog {
	kind: "ReputationGranted";
	moderator: User;
	target: UserResolvable;
	eventType: string;
	scoreChange: number;
	newScore: number;
	reason: string;
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
	Warning: "Member Warned",
	WarningPardoned: "Warning Pardoned",
	ReputationGranted: "Reputation Granted",
};

const embedColors: ModerationKindMapping<keyof typeof Colors> = {
	Ban: "Red",
	TempBan: "Orange",
	SoftBan: "DarkOrange",
	Kick: "Yellow",
	Unban: "Green",
	TempBanEnded: "DarkGreen",
	InviteDeleted: "Blurple",
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
