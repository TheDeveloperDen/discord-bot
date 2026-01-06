import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { clearUserCache } from "../../store/models/DDUser.js";
import {
	ModeratorAction,
	ModeratorActions,
} from "../../store/models/ModeratorActions.js";
import { getSequelizeInstance, initStorage } from "../../store/storage.js";
import { createMockUser } from "../../tests/mocks/discord.js";
import {
	createTempBanModAction,
	getActiveTempBanModAction,
} from "./tempBan.js";

beforeAll(async () => {
	await initStorage();
});

afterEach(async () => {
	await getSequelizeInstance().destroyAll();
	clearUserCache();
});

describe("createTempBanModAction", () => {
	test("creates new temp ban record", async () => {
		const moderator = createMockUser({ id: "12345" });
		const targetUser = createMockUser({ id: "67890" });
		const expires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 1 day from now
		const reason = "Breaking rules";

		const result = await createTempBanModAction(
			moderator,
			targetUser,
			expires,
			reason,
		);

		expect(result).toBeDefined();
		expect(result.action).toBe(ModeratorAction.TEMPBAN);
		expect(result.reason).toBe(reason);
		expect(result.expires?.getTime()).toBe(expires.getTime());
		expect(result.expired).toBe(false);
	});

	test("creates temp ban with null reason", async () => {
		const moderator = createMockUser({ id: "11111" });
		const targetUser = createMockUser({ id: "22222" });
		const expires = new Date(Date.now() + 1000 * 60 * 60);

		const result = await createTempBanModAction(
			moderator,
			targetUser,
			expires,
			null,
		);

		expect(result).toBeDefined();
		expect(result.reason).toBeNull();
	});

	test("updates existing temp ban instead of creating new one", async () => {
		const moderator = createMockUser({ id: "33333" });
		const targetUser = createMockUser({ id: "44444" });
		const originalExpires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
		const newExpires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 1 day

		// Create first temp ban
		const firstBan = await createTempBanModAction(
			moderator,
			targetUser,
			originalExpires,
			"First offense",
		);

		// Create second temp ban for same user (should update)
		const secondBan = await createTempBanModAction(
			moderator,
			targetUser,
			newExpires,
			"Extended ban",
		);

		// Should be the same record (updated)
		expect(secondBan.id).toBe(firstBan.id);
		expect(secondBan.expires?.getTime()).toBe(newExpires.getTime());
		expect(secondBan.reason).toBe("Extended ban");
	});

	test("creates DDUser records for both moderator and target", async () => {
		const moderator = createMockUser({ id: "55555" });
		const targetUser = createMockUser({ id: "66666" });
		const expires = new Date(Date.now() + 1000 * 60 * 60);

		const result = await createTempBanModAction(
			moderator,
			targetUser,
			expires,
			"Test",
		);

		expect(result.moderatorId).toBeDefined();
		expect(result.ddUserId).toBeDefined();
	});
});

describe("getActiveTempBanModAction", () => {
	test("returns active temp ban for user", async () => {
		const moderator = createMockUser({ id: "77777" });
		const targetUser = createMockUser({ id: "88888" });
		const expires = new Date(Date.now() + 1000 * 60 * 60);

		const created = await createTempBanModAction(
			moderator,
			targetUser,
			expires,
			"Test ban",
		);

		const result = await getActiveTempBanModAction(created.ddUserId);

		expect(result).toBeDefined();
		expect(result?.id).toBe(created.id);
	});

	test("returns null when no active temp ban exists", async () => {
		const result = await getActiveTempBanModAction(999999n);

		expect(result).toBeNull();
	});

	test("returns null for expired temp ban", async () => {
		const moderator = createMockUser({ id: "99999" });
		const targetUser = createMockUser({ id: "111111" });
		const expires = new Date(Date.now() + 1000 * 60 * 60);

		const created = await createTempBanModAction(
			moderator,
			targetUser,
			expires,
			"Test ban",
		);

		// Mark as expired
		await created.update({ expired: true });

		const result = await getActiveTempBanModAction(created.ddUserId);

		expect(result).toBeNull();
	});
});
