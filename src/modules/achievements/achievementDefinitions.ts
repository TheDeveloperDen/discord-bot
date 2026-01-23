/**
 * Achievement system definitions
 *
 * Achievements are defined declaratively with conditions that are checked
 * when relevant triggers occur (bump, daily, xp events).
 */

export type AchievementCategory = "bump" | "daily" | "xp";

export type AchievementTrigger =
	| { type: "bump"; event: "bump_recorded" }
	| { type: "daily"; event: "daily_claimed" }
	| { type: "xp"; event: "xp_gained" };

export interface AchievementContext {
	// Bump context
	totalBumps?: number;
	bumpStreak?: number;
	// Daily context
	dailyStreak?: number;
	// XP context
	totalXp?: bigint;
	level?: number;
}

export interface AchievementDefinition {
	id: string;
	name: string;
	description: string;
	emoji: string;
	category: AchievementCategory;
	trigger: AchievementTrigger;
	checkCondition: (context: AchievementContext) => boolean;
	/** Whether the achievement is active. Inactive achievements cannot be awarded and are hidden from display. Defaults to true. */
	active?: boolean;
}

// ─────────────────────────────────────────────────
// Bump Achievements
// ─────────────────────────────────────────────────

const BUMP_ACHIEVEMENTS: AchievementDefinition[] = [
	// Total bumps
	{
		id: "bump_first",
		name: "First Bump",
		description: "Bump the server for the first time",
		emoji: "🎯",
		category: "bump",
		trigger: { type: "bump", event: "bump_recorded" },
		checkCondition: (ctx) => (ctx.totalBumps ?? 0) >= 1,
	},
	{
		id: "bump_10",
		name: "Bump Enthusiast",
		description: "Bump the server 10 times",
		emoji: "🌟",
		category: "bump",
		trigger: { type: "bump", event: "bump_recorded" },
		checkCondition: (ctx) => (ctx.totalBumps ?? 0) >= 10,
	},
	{
		id: "bump_50",
		name: "Bump Master",
		description: "Bump the server 50 times",
		emoji: "🏅",
		category: "bump",
		trigger: { type: "bump", event: "bump_recorded" },
		checkCondition: (ctx) => (ctx.totalBumps ?? 0) >= 50,
	},
	{
		id: "bump_100",
		name: "Bump Legend",
		description: "Bump the server 100 times",
		emoji: "🏆",
		category: "bump",
		trigger: { type: "bump", event: "bump_recorded" },
		checkCondition: (ctx) => (ctx.totalBumps ?? 0) >= 100,
	},
	// Bump streaks
	{
		id: "bump_streak_3",
		name: "Getting Started",
		description: "Achieve a 3-bump streak",
		emoji: "🔥",
		category: "bump",
		trigger: { type: "bump", event: "bump_recorded" },
		checkCondition: (ctx) => (ctx.bumpStreak ?? 0) >= 3,
	},
	{
		id: "bump_streak_7",
		name: "Week Warrior",
		description: "Achieve a 7-bump streak",
		emoji: "📅",
		category: "bump",
		trigger: { type: "bump", event: "bump_recorded" },
		checkCondition: (ctx) => (ctx.bumpStreak ?? 0) >= 7,
	},
	{
		id: "bump_streak_14",
		name: "Fortnight Fighter",
		description: "Achieve a 14-bump streak",
		emoji: "💪",
		category: "bump",
		trigger: { type: "bump", event: "bump_recorded" },
		checkCondition: (ctx) => (ctx.bumpStreak ?? 0) >= 14,
	},
	{
		id: "bump_streak_30",
		name: "Monthly Champion",
		description: "Achieve a 30-bump streak",
		emoji: "👑",
		category: "bump",
		trigger: { type: "bump", event: "bump_recorded" },
		checkCondition: (ctx) => (ctx.bumpStreak ?? 0) >= 30,
	},
];

// ─────────────────────────────────────────────────
// Daily Achievements
// ─────────────────────────────────────────────────

const DAILY_ACHIEVEMENTS: AchievementDefinition[] = [
	{
		id: "daily_first",
		name: "First Daily",
		description: "Claim your first daily reward",
		emoji: "🌅",
		category: "daily",
		trigger: { type: "daily", event: "daily_claimed" },
		checkCondition: (ctx) => (ctx.dailyStreak ?? 0) >= 1,
	},
	{
		id: "daily_streak_7",
		name: "Week of Dedication",
		description: "Maintain a 7-day daily streak",
		emoji: "📆",
		category: "daily",
		trigger: { type: "daily", event: "daily_claimed" },
		checkCondition: (ctx) => (ctx.dailyStreak ?? 0) >= 7,
	},
	{
		id: "daily_streak_30",
		name: "Month of Mastery",
		description: "Maintain a 30-day daily streak",
		emoji: "🗓️",
		category: "daily",
		trigger: { type: "daily", event: "daily_claimed" },
		checkCondition: (ctx) => (ctx.dailyStreak ?? 0) >= 30,
	},
	{
		id: "daily_streak_100",
		name: "Century Club",
		description: "Maintain a 100-day daily streak",
		emoji: "💯",
		category: "daily",
		trigger: { type: "daily", event: "daily_claimed" },
		checkCondition: (ctx) => (ctx.dailyStreak ?? 0) >= 100,
	},
	{
		id: "daily_streak_365",
		name: "Year of Commitment",
		description: "Maintain a 365-day daily streak",
		emoji: "🎉",
		category: "daily",
		trigger: { type: "daily", event: "daily_claimed" },
		checkCondition: (ctx) => (ctx.dailyStreak ?? 0) >= 365,
	},
];

// ─────────────────────────────────────────────────
// XP/Chat Achievements
// ─────────────────────────────────────────────────

const XP_ACHIEVEMENTS: AchievementDefinition[] = [
	// Level milestones
	{
		id: "level_1",
		name: "First Steps",
		description: "Reach level 1",
		emoji: "🌱",
		category: "xp",
		trigger: { type: "xp", event: "xp_gained" },
		checkCondition: (ctx) => (ctx.level ?? 0) >= 1,
	},
	{
		id: "level_10",
		name: "Rising Star",
		description: "Reach level 10",
		emoji: "⭐",
		category: "xp",
		trigger: { type: "xp", event: "xp_gained" },
		checkCondition: (ctx) => (ctx.level ?? 0) >= 10,
	},
	{
		id: "level_25",
		name: "Experienced",
		description: "Reach level 25",
		emoji: "💎",
		category: "xp",
		trigger: { type: "xp", event: "xp_gained" },
		checkCondition: (ctx) => (ctx.level ?? 0) >= 25,
	},
	{
		id: "level_50",
		name: "Veteran",
		description: "Reach level 50",
		emoji: "🔷",
		category: "xp",
		trigger: { type: "xp", event: "xp_gained" },
		checkCondition: (ctx) => (ctx.level ?? 0) >= 50,
	},
	// XP milestones
	{
		id: "xp_1000",
		name: "First Thousand",
		description: "Earn 1,000 XP",
		emoji: "📈",
		category: "xp",
		trigger: { type: "xp", event: "xp_gained" },
		checkCondition: (ctx) => (ctx.totalXp ?? 0n) >= 1000n,
	},
	{
		id: "xp_10000",
		name: "Ten Thousand Club",
		description: "Earn 10,000 XP",
		emoji: "🚀",
		category: "xp",
		trigger: { type: "xp", event: "xp_gained" },
		checkCondition: (ctx) => (ctx.totalXp ?? 0n) >= 10000n,
	},
	{
		id: "xp_100000",
		name: "XP Millionaire",
		description: "Earn 100,000 XP",
		emoji: "💰",
		category: "xp",
		trigger: { type: "xp", event: "xp_gained" },
		checkCondition: (ctx) => (ctx.totalXp ?? 0n) >= 100000n,
	},
];

// ─────────────────────────────────────────────────
// Combined Export
// ─────────────────────────────────────────────────

export const ACHIEVEMENTS: AchievementDefinition[] = [
	...BUMP_ACHIEVEMENTS,
	...DAILY_ACHIEVEMENTS,
	...XP_ACHIEVEMENTS,
];

/**
 * Get all achievements for a specific category
 */
export function getAchievementsByCategory(
	category: AchievementCategory,
): AchievementDefinition[] {
	return ACHIEVEMENTS.filter((a) => a.category === category);
}

/**
 * Get an achievement by its ID
 */
export function getAchievementById(
	id: string,
): AchievementDefinition | undefined {
	return ACHIEVEMENTS.find((a) => a.id === id);
}

/**
 * Get all achievements that match a specific trigger
 */
export function getAchievementsByTrigger(
	trigger: AchievementTrigger,
): AchievementDefinition[] {
	return ACHIEVEMENTS.filter(
		(a) => a.trigger.type === trigger.type && a.trigger.event === trigger.event,
	);
}

/**
 * Get all active achievements (excludes achievements with active: false)
 */
export function getActiveAchievements(): AchievementDefinition[] {
	return ACHIEVEMENTS.filter((a) => a.active !== false);
}

/**
 * Get active achievements that match a specific trigger
 */
export function getActiveAchievementsByTrigger(
	trigger: AchievementTrigger,
): AchievementDefinition[] {
	return getActiveAchievements().filter(
		(a) => a.trigger.type === trigger.type && a.trigger.event === trigger.event,
	);
}

/**
 * Category display information
 */
export const CATEGORY_INFO: Record<
	AchievementCategory,
	{ name: string; emoji: string }
> = {
	bump: { name: "Bump Achievements", emoji: "🎯" },
	daily: { name: "Daily Achievements", emoji: "🌅" },
	xp: { name: "XP Achievements", emoji: "📈" },
};
