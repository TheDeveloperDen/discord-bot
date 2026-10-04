import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import {
	clearUserCache,
	getOrCreateUserById,
} from "../../store/models/DDUser.js";
import { DDUserAchievements } from "../../store/models/DDUserAchievements.js";
import { getSequelizeInstance, initStorage } from "../../store/storage.js";
import { getAchievementById } from "./achievementDefinitions.js";
import {
	checkAndAwardAchievements,
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
