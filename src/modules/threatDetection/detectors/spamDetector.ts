import type { Message } from "discord.js";
import ExpiryMap from "expiry-map";
import { compareTwoStrings } from "string-similarity";
import { ThreatAction, ThreatType } from "../../../store/models/ThreatLog.js";

export interface SpamDetectionResult {
	detected: boolean;
	threatType: ThreatType;
	severity: number;
	action: ThreatAction;
	details: {
		messageCount: number;
		windowSeconds: number;
		maxSimilarity: number;
		duplicateDetected: boolean;
	};
}

interface UserMessageWindow {
	messages: Array<{
		content: string;
		timestamp: number;
		channelId: string;
	}>;
}

const userMessageCache = new ExpiryMap<string, UserMessageWindow>(60_000);
const MAX_MESSAGES_PER_USER = 50;

function cleanOldMessages(
	window: UserMessageWindow,
	windowMs: number,
): UserMessageWindow {
	const now = Date.now();
	return {
		messages: window.messages
			.filter((m) => now - m.timestamp < windowMs)
			.slice(-MAX_MESSAGES_PER_USER),
	};
}

function calculateMaxSimilarity(
	newContent: string,
	existingMessages: UserMessageWindow["messages"],
): number {
	if (existingMessages.length === 0) return 0;

	let maxSimilarity = 0;
	for (const msg of existingMessages) {
		const similarity = compareTwoStrings(
			newContent.toLowerCase(),
			msg.content.toLowerCase(),
		);
		maxSimilarity = Math.max(maxSimilarity, similarity);
	}
	return maxSimilarity;
}

export function detectSpam(
	message: Message,
	config: {
		maxMessagesPerWindow: number;
		windowSeconds: number;
		duplicateThreshold: number;
		action: "delete" | "mute";
	},
): SpamDetectionResult {
	const userId = message.author.id;
	const windowMs = config.windowSeconds * 1000;

	let userWindow = userMessageCache.get(userId) || { messages: [] };
	userWindow = cleanOldMessages(userWindow, windowMs);

	const messageCount = userWindow.messages.length + 1;
	const maxSimilarity = calculateMaxSimilarity(
		message.content,
		userWindow.messages,
	);
	const duplicateDetected = maxSimilarity >= config.duplicateThreshold;

	userWindow.messages.push({
		content: message.content,
		timestamp: Date.now(),
		channelId: message.channelId,
	});
	userMessageCache.set(userId, userWindow);

	const rateExceeded = messageCount > config.maxMessagesPerWindow;
	const detected = rateExceeded || duplicateDetected;

	let severity = 0;
	if (rateExceeded) {
		severity = Math.min(messageCount / config.maxMessagesPerWindow, 1);
	}
	if (duplicateDetected) {
		severity = Math.max(severity, maxSimilarity);
	}

	return {
		detected,
		threatType: ThreatType.SPAM,
		severity,
		action: detected
			? config.action === "mute"
				? ThreatAction.MUTED
				: ThreatAction.DELETED
			: ThreatAction.FLAGGED,
		details: {
			messageCount,
			windowSeconds: config.windowSeconds,
			maxSimilarity,
			duplicateDetected,
		},
	};
}

export function clearUserSpamCache(userId: string): void {
	userMessageCache.delete(userId);
}
