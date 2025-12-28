import type { Message } from "discord.js";
import ExpiryMap from "expiry-map";
import { ThreatAction, ThreatType } from "../../../store/models/ThreatLog.js";

export interface MentionSpamResult {
	detected: boolean;
	threatType: ThreatType;
	severity: number;
	action: ThreatAction;
	details: {
		mentionsInMessage: number;
		mentionsInWindow: number;
		windowSeconds: number;
		hasEveryone: boolean;
	};
}

interface UserMentionWindow {
	mentions: Array<{
		count: number;
		timestamp: number;
	}>;
}

const userMentionCache = new ExpiryMap<string, UserMentionWindow>(60_000);

function cleanOldMentions(
	window: UserMentionWindow,
	windowMs: number,
): UserMentionWindow {
	const now = Date.now();
	return {
		mentions: window.mentions.filter((m) => now - m.timestamp < windowMs),
	};
}

function countMentions(message: Message): {
	total: number;
	users: number;
	roles: number;
	hasEveryone: boolean;
} {
	const users = message.mentions.users.size;
	const roles = message.mentions.roles.size;
	const hasEveryone = message.mentions.everyone;

	return {
		total: users + roles + (hasEveryone ? 1 : 0),
		users,
		roles,
		hasEveryone,
	};
}

export function detectMentionSpam(
	message: Message,
	config: {
		maxMentionsPerMessage: number;
		maxMentionsPerWindow: number;
		windowSeconds: number;
		action: "delete" | "mute";
	},
): MentionSpamResult {
	const userId = message.author.id;
	const windowMs = config.windowSeconds * 1000;

	const mentionCounts = countMentions(message);

	let userWindow = userMentionCache.get(userId) || { mentions: [] };
	userWindow = cleanOldMentions(userWindow, windowMs);

	const mentionsInWindow =
		userWindow.mentions.reduce((sum, m) => sum + m.count, 0) +
		mentionCounts.total;

	userWindow.mentions.push({
		count: mentionCounts.total,
		timestamp: Date.now(),
	});
	userMentionCache.set(userId, userWindow);

	const messageExceeded = mentionCounts.total > config.maxMentionsPerMessage;
	const windowExceeded = mentionsInWindow > config.maxMentionsPerWindow;
	const detected =
		messageExceeded || windowExceeded || mentionCounts.hasEveryone;

	let severity = 0;
	if (messageExceeded) {
		severity = Math.min(mentionCounts.total / config.maxMentionsPerMessage, 1);
	}
	if (windowExceeded) {
		severity = Math.max(
			severity,
			Math.min(mentionsInWindow / config.maxMentionsPerWindow, 1),
		);
	}
	if (mentionCounts.hasEveryone) {
		severity = Math.max(severity, 0.9);
	}

	return {
		detected,
		threatType: ThreatType.MENTION_SPAM,
		severity,
		action: detected
			? config.action === "mute"
				? ThreatAction.MUTED
				: ThreatAction.DELETED
			: ThreatAction.FLAGGED,
		details: {
			mentionsInMessage: mentionCounts.total,
			mentionsInWindow,
			windowSeconds: config.windowSeconds,
			hasEveryone: mentionCounts.hasEveryone,
		},
	};
}

export function clearUserMentionCache(userId: string): void {
	userMentionCache.delete(userId);
}
