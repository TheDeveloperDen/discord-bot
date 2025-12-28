import { getOrCreateUserById } from "../../store/models/DDUser.js";
import {
	createReputationEvent,
	getReputationHistory,
	type ReputationEvent,
	ReputationEventType,
} from "../../store/models/ReputationEvent.js";
import { WarningSeverity } from "../../store/models/Warning.js";

export enum ReputationTier {
	TRUSTED = "TRUSTED",
	GOOD = "GOOD",
	NEUTRAL = "NEUTRAL",
	WATCH = "WATCH",
	RESTRICTED = "RESTRICTED",
}

export const REPUTATION_TIER_THRESHOLDS: Record<ReputationTier, number> = {
	[ReputationTier.TRUSTED]: 200,
	[ReputationTier.GOOD]: 50,
	[ReputationTier.NEUTRAL]: -50,
	[ReputationTier.WATCH]: -200,
	[ReputationTier.RESTRICTED]: Number.NEGATIVE_INFINITY,
};

export const REPUTATION_TIER_LABELS: Record<ReputationTier, string> = {
	[ReputationTier.TRUSTED]: "Trusted",
	[ReputationTier.GOOD]: "Good",
	[ReputationTier.NEUTRAL]: "Neutral",
	[ReputationTier.WATCH]: "Watch",
	[ReputationTier.RESTRICTED]: "Restricted",
};

export const REPUTATION_TIER_COLORS: Record<ReputationTier, number> = {
	[ReputationTier.TRUSTED]: 0x22c55e, // Green
	[ReputationTier.GOOD]: 0x3b82f6, // Blue
	[ReputationTier.NEUTRAL]: 0x6b7280, // Gray
	[ReputationTier.WATCH]: 0xf59e0b, // Amber
	[ReputationTier.RESTRICTED]: 0xef4444, // Red
};

/**
 * Get the reputation tier for a given score
 */
export function getReputationTier(score: number): ReputationTier {
	if (score >= REPUTATION_TIER_THRESHOLDS[ReputationTier.TRUSTED]) {
		return ReputationTier.TRUSTED;
	}
	if (score >= REPUTATION_TIER_THRESHOLDS[ReputationTier.GOOD]) {
		return ReputationTier.GOOD;
	}
	if (score >= REPUTATION_TIER_THRESHOLDS[ReputationTier.NEUTRAL]) {
		return ReputationTier.NEUTRAL;
	}
	if (score >= REPUTATION_TIER_THRESHOLDS[ReputationTier.WATCH]) {
		return ReputationTier.WATCH;
	}
	return ReputationTier.RESTRICTED;
}

/**
 * Get user's current reputation data
 */
export async function getUserReputation(userId: bigint): Promise<{
	score: number;
	tier: ReputationTier;
	tierLabel: string;
	tierColor: number;
}> {
	const user = await getOrCreateUserById(userId);
	const score = user.reputationScore;
	const tier = getReputationTier(score);

	return {
		score,
		tier,
		tierLabel: REPUTATION_TIER_LABELS[tier],
		tierColor: REPUTATION_TIER_COLORS[tier],
	};
}

/**
 * Update a user's reputation score and create an event
 */
export async function updateReputation(
	userId: bigint,
	eventType: ReputationEventType,
	options?: {
		reason?: string;
		grantedBy?: bigint;
		relatedId?: number;
		customScore?: number;
	},
): Promise<{
	event: ReputationEvent;
	newScore: number;
	oldTier: ReputationTier;
	newTier: ReputationTier;
}> {
	const user = await getOrCreateUserById(userId);
	const oldScore = user.reputationScore;
	const oldTier = getReputationTier(oldScore);

	const event = await createReputationEvent(userId, eventType, options);

	const newScore = oldScore + event.scoreChange;
	user.reputationScore = newScore;
	user.lastReputationUpdate = new Date();
	await user.save();

	const newTier = getReputationTier(newScore);

	return {
		event,
		newScore,
		oldTier,
		newTier,
	};
}

/**
 * Grant positive reputation to a user
 */
export async function grantReputation(
	userId: bigint,
	eventType: ReputationEventType,
	grantedBy: bigint,
	reason?: string,
	relatedId?: number,
	customScore?: number,
): Promise<{
	event: ReputationEvent;
	newScore: number;
	tierChanged: boolean;
	newTier: ReputationTier;
}> {
	const result = await updateReputation(userId, eventType, {
		reason,
		grantedBy,
		relatedId,
		customScore,
	});

	return {
		event: result.event,
		newScore: result.newScore,
		tierChanged: result.oldTier !== result.newTier,
		newTier: result.newTier,
	};
}

/**
 * Deduct reputation from a user (for automated systems)
 */
export async function deductReputation(
	userId: bigint,
	eventType: ReputationEventType,
	reason?: string,
	relatedId?: number,
): Promise<{
	event: ReputationEvent;
	newScore: number;
	tierChanged: boolean;
	newTier: ReputationTier;
}> {
	const result = await updateReputation(userId, eventType, {
		reason,
		relatedId,
	});

	return {
		event: result.event,
		newScore: result.newScore,
		tierChanged: result.oldTier !== result.newTier,
		newTier: result.newTier,
	};
}

/**
 * Get warning event type based on severity
 */
export function getWarningEventType(
	severity: WarningSeverity,
): ReputationEventType {
	switch (severity) {
		case WarningSeverity.MINOR:
			return ReputationEventType.WARNING_MINOR;
		case WarningSeverity.MODERATE:
			return ReputationEventType.WARNING_MODERATE;
		case WarningSeverity.SEVERE:
			return ReputationEventType.WARNING_SEVERE;
		default:
			return ReputationEventType.WARNING_MINOR;
	}
}

/**
 * Get reputation history for a user
 */
export async function getReputationHistoryForUser(
	userId: bigint,
	limit = 20,
): Promise<ReputationEvent[]> {
	return getReputationHistory(userId, limit);
}

/**
 * Calculate XP modifier based on reputation tier
 */
export function getXpModifier(tier: ReputationTier): number {
	switch (tier) {
		case ReputationTier.TRUSTED:
			return 1.25; // 25% bonus XP
		case ReputationTier.GOOD:
			return 1.1; // 10% bonus XP
		case ReputationTier.NEUTRAL:
			return 1; // Normal XP
		case ReputationTier.WATCH:
			return 0.75; // 25% less XP
		case ReputationTier.RESTRICTED:
			return 0; // No XP
		default:
			return 1;
	}
}
