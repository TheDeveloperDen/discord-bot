/**
 * Achievement Service
 *
 * Core logic for checking and awarding achievements to users.
 */

import * as Sentry from "@sentry/node";
import { UniqueConstraintError } from "@sequelize/core";
import { logger } from "../../logging.js";
import type { DDUser } from "../../store/models/DDUser.js";
import { DDUserAchievements } from "../../store/models/DDUserAchievements.js";
import {
	type AchievementCategory,
	type AchievementContext,
	type AchievementDefinition,
	type AchievementTrigger,
	getAchievementById,
	getActiveAchievements,
	getActiveAchievementsByTrigger,
} from "./achievementDefinitions.js";

export interface AwardedAchievement {
	definition: AchievementDefinition;
	awardedAt: Date;
}

export interface UserAchievementRecord {
	achievementId: string;
	awardedAt: Date;
}

/**
 * Check and award achievements for a user based on a trigger event.
 *
 * @param user The DDUser to check achievements for
 * @param trigger The trigger that caused this check (bump, daily, xp)
 * @param context Additional context needed to evaluate achievement conditions
 * @returns Array of newly awarded achievements (empty if none were awarded)
 */
export async function checkAndAwardAchievements(
	user: DDUser,
	trigger: AchievementTrigger,
	context: AchievementContext,
): Promise<AwardedAchievement[]> {
	return await Sentry.startSpan(
		{
			name: "checkAndAwardAchievements",
			attributes: {
				userId: user.id.toString(),
				triggerType: trigger.type,
				triggerEvent: trigger.event,
			},
		},
		async () => {
			const relevantAchievements = getActiveAchievementsByTrigger(trigger);
			const newlyAwarded: AwardedAchievement[] = [];

			// Get user's existing achievements
			const existingAchievements = await getUserAchievementIds(user.id);

			for (const achievement of relevantAchievements) {
				// Skip if already has this achievement
				if (existingAchievements.has(achievement.id)) {
					continue;
				}

				// Check if user meets the condition
				if (achievement.checkCondition(context)) {
					const awarded = await awardAchievement(user.id, achievement.id);
					if (awarded) {
						newlyAwarded.push({
							definition: achievement,
							awardedAt: new Date(),
						});
						logger.info(
							`Awarded achievement "${achievement.name}" to user ${user.id}`,
						);
					}
				}
			}

			return newlyAwarded;
		},
	);
}

/**
 * Award a specific achievement to a user.
 *
 * @returns true if the achievement was newly awarded, false if already had it
 */
async function awardAchievement(
	userId: bigint,
	achievementId: string,
): Promise<boolean> {
	try {
		await DDUserAchievements.create({
			achievementId,
			ddUserId: userId,
		});
		return true;
	} catch (error) {
		// Unique constraint violation means they already have it
		if (error instanceof UniqueConstraintError) {
			return false;
		}
		throw error;
	}
}

/**
 * Get all achievement IDs that a user has earned.
 */
async function getUserAchievementIds(userId: bigint): Promise<Set<string>> {
	const records = await DDUserAchievements.findAll({
		where: { ddUserId: userId },
		attributes: ["achievementId"],
	});
	return new Set(records.map((r) => r.achievementId));
}

/**
 * Get all achievements for a user with their award dates.
 */
export async function getUserAchievements(
	userId: bigint,
): Promise<UserAchievementRecord[]> {
	const records = await DDUserAchievements.findAll({
		where: { ddUserId: userId },
		order: [["createdAt", "ASC"]],
	});

	return records.map((r) => ({
		achievementId: r.achievementId,
		awardedAt: r.createdAt as Date,
	}));
}

/**
 * Check if a user has a specific achievement.
 */
export async function hasAchievement(
	userId: bigint,
	achievementId: string,
): Promise<boolean> {
	const record = await DDUserAchievements.findOne({
		where: {
			ddUserId: userId,
			achievementId,
		},
	});
	return record !== null;
}

export interface GrantResult {
	success: boolean;
	alreadyHad: boolean;
	error?: string;
}

export interface RevokeResult {
	success: boolean;
	didNotHave: boolean;
	error?: string;
}

/**
 * Manually grant an achievement to a user.
 * Used by moderation commands to award achievements that can't be earned automatically.
 *
 * @param userId The user ID to grant the achievement to
 * @param achievementId The achievement ID to grant
 * @returns Result indicating success, already had, or error
 */
export async function grantAchievement(
	userId: bigint,
	achievementId: string,
): Promise<GrantResult> {
	const achievement = getAchievementById(achievementId);
	if (!achievement) {
		return {
			success: false,
			alreadyHad: false,
			error: "Achievement not found",
		};
	}

	if (achievement.active === false) {
		return {
			success: false,
			alreadyHad: false,
			error: "Achievement is inactive",
		};
	}

	const awarded = await awardAchievement(userId, achievementId);
	if (!awarded) {
		return { success: false, alreadyHad: true };
	}

	logger.info(
		`Manually granted achievement "${achievement.name}" to user ${userId}`,
	);
	return { success: true, alreadyHad: false };
}

/**
 * Revoke an achievement from a user.
 * Uses soft delete (paranoid mode) to maintain audit trail.
 *
 * @param userId The user ID to revoke the achievement from
 * @param achievementId The achievement ID to revoke
 * @returns Result indicating success, didn't have, or error
 */
export async function revokeAchievement(
	userId: bigint,
	achievementId: string,
): Promise<RevokeResult> {
	const achievement = getAchievementById(achievementId);
	if (!achievement) {
		return {
			success: false,
			didNotHave: false,
			error: "Achievement not found",
		};
	}

	const record = await DDUserAchievements.findOne({
		where: {
			ddUserId: userId,
			achievementId,
		},
	});

	if (!record) {
		return { success: false, didNotHave: true };
	}

	await record.destroy(); // Soft delete (sets deletedAt)
	logger.info(`Revoked achievement "${achievement.name}" from user ${userId}`);
	return { success: true, didNotHave: false };
}

/**
 * Get achievement progress stats for a user.
 */
export async function getAchievementProgress(userId: bigint): Promise<{
	total: number;
	unlocked: number;
	byCategory: Record<AchievementCategory, { total: number; unlocked: number }>;
}> {
	const userAchievements = await getUserAchievementIds(userId);

	const byCategory: Record<
		AchievementCategory,
		{ total: number; unlocked: number }
	> = {
		bump: { total: 0, unlocked: 0 },
		daily: { total: 0, unlocked: 0 },
		xp: { total: 0, unlocked: 0 },
		special: { total: 0, unlocked: 0 },
	};

	const activeAchievements = getActiveAchievements();
	for (const achievement of activeAchievements) {
		byCategory[achievement.category].total++;
		if (userAchievements.has(achievement.id)) {
			byCategory[achievement.category].unlocked++;
		}
	}

	return {
		total: activeAchievements.length,
		unlocked: userAchievements.size,
		byCategory,
	};
}

/**
 * Get detailed achievement info for display, including unlock status.
 */
export async function getAchievementsWithStatus(userId: bigint): Promise<
	Array<{
		definition: AchievementDefinition;
		unlocked: boolean;
		unlockedAt?: Date;
	}>
> {
	const records = await getUserAchievements(userId);
	const recordMap = new Map(records.map((r) => [r.achievementId, r.awardedAt]));

	return getActiveAchievements().map((definition) => {
		const unlockedAt = recordMap.get(definition.id);
		return {
			definition,
			unlocked: unlockedAt !== undefined,
			unlockedAt,
		};
	});
}

/**
 * Get achievement definition with user's unlock status.
 */
export async function getAchievementWithStatus(
	userId: bigint,
	achievementId: string,
): Promise<{
	definition: AchievementDefinition;
	unlocked: boolean;
	unlockedAt?: Date;
} | null> {
	const definition = getAchievementById(achievementId);
	if (!definition) return null;

	const record = await DDUserAchievements.findOne({
		where: {
			ddUserId: userId,
			achievementId,
		},
	});

	return {
		definition,
		unlocked: record !== null,
		unlockedAt: record?.createdAt as Date | undefined,
	};
}
