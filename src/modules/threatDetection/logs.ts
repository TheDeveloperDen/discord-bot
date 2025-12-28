import {
	type Client,
	type Colors,
	EmbedBuilder,
	type Snowflake,
	type User,
} from "discord.js";
import { config } from "../../Config.js";
import { logger } from "../../logging.js";
import { actualMention, fakeMention } from "../../util/users.js";

export type ThreatLog =
	| ScamLinkDetectedLog
	| RaidAlertLog
	| SpamDetectedLog
	| ToxicContentDetectedLog
	| SuspiciousAccountLog;

interface ScamLinkDetectedLog {
	kind: "ScamLinkDetected";
	target: User;
	messageId: Snowflake;
	messageCreatedTimestamp: number;
	edited: boolean;
	matchedUrls: string[];
	matchedDomains: string[];
	matchReason: "pattern" | "api" | "database";
	severity: number;
}

interface RaidAlertLog {
	kind: "RaidAlert";
	joinCount: number;
	windowSeconds: number;
	newAccountCount: number;
	raidModeActivated: boolean;
}

interface SpamDetectedLog {
	kind: "SpamDetected";
	target: User;
	messageCount: number;
	windowSeconds: number;
	action: string;
}

interface ToxicContentDetectedLog {
	kind: "ToxicContentDetected";
	target: User;
	matchedWord: string | null;
	category: string | null;
	bypassAttempted: boolean;
	action: string;
}

interface SuspiciousAccountLog {
	kind: "SuspiciousAccount";
	target: User;
	accountAgeDays: number;
	reasons: string[];
}

type ThreatKindMapping<T> = {
	[f in ThreatLog["kind"]]: T;
};

const embedTitles: ThreatKindMapping<string> = {
	ScamLinkDetected: "Scam Link Detected",
	RaidAlert: "Raid Alert",
	SpamDetected: "Spam Detected",
	ToxicContentDetected: "Toxic Content Detected",
	SuspiciousAccount: "Suspicious Account",
};

const embedColors: ThreatKindMapping<keyof typeof Colors> = {
	ScamLinkDetected: "Red",
	RaidAlert: "DarkRed",
	SpamDetected: "Orange",
	ToxicContentDetected: "DarkOrange",
	SuspiciousAccount: "Yellow",
};

const embedDescriptions: {
	[K in ThreatLog["kind"]]?: (t: Extract<ThreatLog, { kind: K }>) => string;
} = {
	ScamLinkDetected: (log) => {
		let desc = `Message at <t:${Math.round(log.messageCreatedTimestamp / 1000)}> ${log.edited ? "was edited to contain" : "contained"} a scam link!\n\n`;
		desc += `**Matched URLs:** \`${log.matchedUrls.join("`, `")}\`\n`;
		desc += `**Matched Domains:** \`${log.matchedDomains.join("`, `")}\`\n`;
		desc += `**Detection Method:** ${log.matchReason}\n`;
		desc += `**Severity:** ${(log.severity * 100).toFixed(0)}%`;
		return desc;
	},
	RaidAlert: (log) =>
		`**${log.joinCount} users joined** in ${log.windowSeconds} seconds!\n` +
		`**New accounts (<7 days):** ${log.newAccountCount}\n` +
		`**Raid mode activated:** ${log.raidModeActivated ? "Yes" : "No"}`,
	SpamDetected: (log) =>
		`Sent **${log.messageCount} messages** in ${log.windowSeconds} seconds.\n` +
		`**Action taken:** ${log.action}`,
	ToxicContentDetected: (log) => {
		let desc = `Message contained toxic content.\n`;
		if (log.matchedWord) {
			desc += `**Matched word:** ||${log.matchedWord}||\n`;
		}
		if (log.category) {
			desc += `**Category:** ${log.category}\n`;
		}
		if (log.bypassAttempted) {
			desc += `**Bypass attempted:** Yes\n`;
		}
		desc += `**Action taken:** ${log.action}`;
		return desc;
	},
	SuspiciousAccount: (log) =>
		`Account is **${log.accountAgeDays.toFixed(1)} days old**.\n` +
		`**Reasons:** ${log.reasons.join(", ")}`,
};

export async function logThreatAction(
	client: Client,
	action: ThreatLog,
): Promise<void> {
	const alertChannel = config.threatDetection?.alertChannel;
	const channelId = alertChannel || config.channels.modLog;

	const channel = await client.channels.fetch(channelId);
	if (!channel) {
		logger.error("Threat log channel does not exist");
		return;
	}

	if (!channel.isSendable()) {
		logger.error("Threat log channel is not sendable");
		return;
	}

	const embed = new EmbedBuilder();
	embed.setTitle(embedTitles[action.kind]);
	embed.setColor(embedColors[action.kind]);

	let description = "";

	if ("target" in action) {
		const targetUser = await client.users
			.fetch(action.target)
			.catch(() => null);
		description += `**User:** ${targetUser && fakeMention(targetUser)} ${actualMention(action.target)}\n\n`;
	}

	const descriptionFn = embedDescriptions[action.kind];
	if (descriptionFn) {
		// biome-ignore lint/suspicious/noExplicitAny: type safety ensured by kind
		description += descriptionFn(action as any);
	}

	embed.setDescription(description);
	embed.setTimestamp();

	await channel.send({
		embeds: [embed],
	});
}
