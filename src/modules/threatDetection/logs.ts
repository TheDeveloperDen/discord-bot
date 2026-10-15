import type { Client, Snowflake, User } from "discord.js";
import { config } from "../../Config.js";
import { logger } from "../../logging.js";
import { renderThreatLog } from "./logs.card.js";

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

	const target =
		"target" in action
			? await client.users.fetch(action.target).catch(() => null)
			: null;
	await channel.send(renderThreatLog(action, target));
}
