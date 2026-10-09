import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import {
	clearUserCache,
	getOrCreateUserById,
} from "../../store/models/DDUser.js";
import { DDUserAchievements } from "../../store/models/DDUserAchievements.js";
import { getSequelizeInstance, initStorage } from "../../store/storage.js";
import {
	getAchievementById,
	getActiveAchievements,
} from "./achievementDefinitions.js";
import {
	checkAndAwardAchievements,
	getAchievementProgress,
	getAchievementsWithStatus,
	getAllRounderCategoryCount,
	grantAchievement,
	hasAchievement,
} from "./achievementService.js";

beforeAll(async () => {
	await initStorage();
});

afterEach(async () => {
	await getSequelizeInstance().destroyAll();
	clearUserCache();
});

async function giveAchievements(userId: bigint, achievementIds: string[]) {
	await Promise.all(
		achievementIds.map((achievementId) =>
			DDUserAchievements.create({ ddUserId: userId, achievementId }),
		),
	);
}

async function expectProgressToMatchStatus(userId: bigint) {
	const [progress, achievements] = await Promise.all([
		getAchievementProgress(userId),
		getAchievementsWithStatus(userId),
	]);

	expect(progress.total).toBe(achievements.length);
	expect(progress.unlocked).toBe(
		achievements.filter(({ unlocked }) => unlocked).length,
	);
	expect(
		Object.values(progress.byCategory).reduce(
			(total, category) => total + category.total,
			0,
		),
	).toBe(achievements.length);
	expect(
		Object.values(progress.byCategory).reduce(
			(total, category) => total + category.unlocked,
			0,
		),
	).toBe(achievements.filter(({ unlocked }) => unlocked).length);

	for (const [category, categoryProgress] of Object.entries(
		progress.byCategory,
	)) {
		const achievementsInCategory = achievements.filter(
			({ definition }) => definition.category === category,
		);
		expect(categoryProgress.total).toBe(achievementsInCategory.length);
		expect(categoryProgress.unlocked).toBe(
			achievementsInCategory.filter(({ unlocked }) => unlocked).length,
		);
	}

	return progress;
}

describe("All-Rounder", () => {
	test("requires four distinct active categories despite multiple awards in one category", async () => {
		const user = await getOrCreateUserById(101n);
		await giveAchievements(user.id, [
			"bump_first",
			"bump_10",
			"bump_50",
			"bump_100",
			"daily_first",
			"starboard_first",
		]);

		const awarded = await checkAndAwardAchievements(
			user,
			{ type: "xp", event: "xp_gained" },
			{ level: 0 },
		);

		expect(awarded).toEqual([]);
		expect(await hasAchievement(user.id, "all_rounder")).toBe(false);
	});

	test("excludes unknown, inactive, revoked, and self-meta records from category counts", async () => {
		const user = await getOrCreateUserById(102n);
		await giveAchievements(user.id, [
			"bump_first",
			"daily_first",
			"starboard_first",
			"level_5",
			"suggestion_first",
			"unknown_achievement",
			"all_rounder",
		]);
		const revoked = await DDUserAchievements.findOne({
			where: { ddUserId: user.id, achievementId: "suggestion_first" },
		});
		if (!revoked) throw new Error("Expected seeded achievement record");
		await revoked.destroy();

		const levelAchievement = getAchievementById("level_5");
		if (!levelAchievement)
			throw new Error("Expected level achievement definition");
		const originalActive = levelAchievement.active;
		levelAchievement.active = false;
		try {
			expect(await getAllRounderCategoryCount(user.id)).toBe(3);
		} finally {
			levelAchievement.active = originalActive;
		}
	});

	test("awards existing eligible users after a check that earns no normal badge", async () => {
		const user = await getOrCreateUserById(103n);
		await giveAchievements(user.id, [
			"bump_first",
			"daily_first",
			"starboard_first",
			"suggestion_first",
		]);

		const awarded = await checkAndAwardAchievements(
			user,
			{ type: "xp", event: "xp_gained" },
			{ level: 0 },
		);

		expect(awarded.map(({ definition }) => definition.id)).toEqual([
			"all_rounder",
		]);
		expect(await hasAchievement(user.id, "all_rounder")).toBe(true);
	});

	test("returns All-Rounder with a manual fourth-category award", async () => {
		const user = await getOrCreateUserById(104n);
		await giveAchievements(user.id, [
			"bump_first",
			"daily_first",
			"starboard_first",
		]);

		const result = await grantAchievement(user.id, "project_contributor");

		expect(result.error).toBeUndefined();
		expect(result.alreadyHad).toBe(false);
		expect(result.awarded.map(({ definition }) => definition.id)).toEqual([
			"project_contributor",
			"all_rounder",
		]);
	});
});

describe("Achievement progress", () => {
	test("reports no unlocked achievements for a user without awards", async () => {
		const user = await getOrCreateUserById(105n);

		const progress = await expectProgressToMatchStatus(user.id);

		expect(progress.total).toBe(getActiveAchievements().length);
		expect(progress.unlocked).toBe(0);
	});

	test("excludes unknown, inactive, and soft-revoked awards", async () => {
		const [activeAchievement, inactiveAchievement, revokedAchievement] =
			getActiveAchievements();
		if (!activeAchievement || !inactiveAchievement || !revokedAchievement) {
			throw new Error("Expected at least three active achievement definitions");
		}

		const user = await getOrCreateUserById(106n);
		await giveAchievements(user.id, [
			activeAchievement.id,
			inactiveAchievement.id,
			revokedAchievement.id,
			"unknown_achievement",
		]);
		const revoked = await DDUserAchievements.findOne({
			where: { ddUserId: user.id, achievementId: revokedAchievement.id },
		});
		if (!revoked) throw new Error("Expected seeded achievement record");
		await revoked.destroy();

		const originalActive = inactiveAchievement.active;
		inactiveAchievement.active = false;
		try {
			const progress = await expectProgressToMatchStatus(user.id);

			expect(progress.total).toBe(getActiveAchievements().length);
			expect(progress.unlocked).toBe(1);
		} finally {
			inactiveAchievement.active = originalActive;
		}
	});

	test("updates the maximum and unlocked count when an earned definition reactivates", async () => {
		const activeAchievements = getActiveAchievements();
		const reactivatedAchievement = activeAchievements[0];
		if (!reactivatedAchievement) {
			throw new Error("Expected an active achievement definition");
		}

		const user = await getOrCreateUserById(107n);
		await giveAchievements(user.id, [reactivatedAchievement.id]);

		const originalActive = reactivatedAchievement.active;
		reactivatedAchievement.active = false;
		try {
			const inactiveProgress = await expectProgressToMatchStatus(user.id);
			expect(inactiveProgress.total).toBe(activeAchievements.length - 1);
			expect(inactiveProgress.unlocked).toBe(0);

			reactivatedAchievement.active = true;
			const reactivatedProgress = await expectProgressToMatchStatus(user.id);
			expect(reactivatedProgress.total).toBe(activeAchievements.length);
			expect(reactivatedProgress.unlocked).toBe(1);
		} finally {
			reactivatedAchievement.active = originalActive;
		}
	});

	test("does not let unknown records exceed a completed active catalog", async () => {
		const activeAchievementIds = getActiveAchievements().map(({ id }) => id);
		const user = await getOrCreateUserById(108n);
		await giveAchievements(user.id, [
			...activeAchievementIds,
			"unknown_achievement",
		]);

		const progress = await expectProgressToMatchStatus(user.id);

		expect(progress.total).toBe(activeAchievementIds.length);
		expect(progress.unlocked).toBe(progress.total);
	});
});
