import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { Op } from "@sequelize/core";
import { clearUserCache } from "../../store/models/DDUser.js";
import {
	ModeratorAction,
	ModeratorActions,
} from "../../store/models/ModeratorActions.js";
import { getSequelizeInstance, initStorage } from "../../store/storage.js";
import { createMockUser } from "../../tests/mocks/discord.js";
import { createTempBanModAction } from "./tempBan.js";

beforeAll(async () => {
	await initStorage();
});

afterEach(async () => {
	await getSequelizeInstance().destroyAll();
	clearUserCache();
});

describe("TempBan expiration detection", () => {
	// These tests verify the database query logic used by the listener

	test("finds expired temp bans", async () => {
		const moderator = createMockUser({ id: "12345" });
		const targetUser = createMockUser({ id: "67890" });
		// Expired 1 hour ago
		const expires = new Date(Date.now() - 1000 * 60 * 60);

		await createTempBanModAction(moderator, targetUser, expires, "Test ban");

		// Query for expired bans (same as listener does)
		const expiredBans = await ModeratorActions.findAll({
			where: {
				action: ModeratorAction.TEMPBAN,
				expired: false,
				expires: {
					[Op.lt]: new Date(),
				},
			},
		});

		expect(expiredBans.length).toBe(1);
	});

	test("does not find non-expired temp bans", async () => {
		const moderator = createMockUser({ id: "22222" });
		const targetUser = createMockUser({ id: "33333" });
		// Expires in 1 hour
		const expires = new Date(Date.now() + 1000 * 60 * 60);

		await createTempBanModAction(moderator, targetUser, expires, "Test ban");

		const expiredBans = await ModeratorActions.findAll({
			where: {
				action: ModeratorAction.TEMPBAN,
				expired: false,
				expires: {
					[Op.lt]: new Date(),
				},
			},
		});

		expect(expiredBans.length).toBe(0);
	});

	test("does not find already-expired temp bans", async () => {
		const moderator = createMockUser({ id: "44444" });
		const targetUser = createMockUser({ id: "55555" });
		const expires = new Date(Date.now() - 1000 * 60 * 60);

		const ban = await createTempBanModAction(
			moderator,
			targetUser,
			expires,
			"Test ban",
		);

		// Mark as already processed
		await ban.update({ expired: true });

		const expiredBans = await ModeratorActions.findAll({
			where: {
				action: ModeratorAction.TEMPBAN,
				expired: false,
				expires: {
					[Op.lt]: new Date(),
				},
			},
		});

		expect(expiredBans.length).toBe(0);
	});

	test("marks ban as expired after processing", async () => {
		const moderator = createMockUser({ id: "66666" });
		const targetUser = createMockUser({ id: "77777" });
		const expires = new Date(Date.now() - 1000 * 60 * 60);

		const ban = await createTempBanModAction(
			moderator,
			targetUser,
			expires,
			"Test ban",
		);

		// Simulate what the listener does
		await ban.update({ expired: true });

		// Verify it's marked as expired
		await ban.reload();
		expect(ban.expired).toBe(true);
	});

	test("handles multiple expired bans", async () => {
		const moderator = createMockUser({ id: "88888" });
		const expires = new Date(Date.now() - 1000 * 60 * 60);

		// Create multiple expired bans for different users
		await createTempBanModAction(
			moderator,
			createMockUser({ id: "111111" }),
			expires,
			"Ban 1",
		);
		await createTempBanModAction(
			moderator,
			createMockUser({ id: "222222" }),
			expires,
			"Ban 2",
		);
		await createTempBanModAction(
			moderator,
			createMockUser({ id: "333333" }),
			expires,
			"Ban 3",
		);

		const expiredBans = await ModeratorActions.findAll({
			where: {
				action: ModeratorAction.TEMPBAN,
				expired: false,
				expires: {
					[Op.lt]: new Date(),
				},
			},
		});

		expect(expiredBans.length).toBe(3);
	});
});
