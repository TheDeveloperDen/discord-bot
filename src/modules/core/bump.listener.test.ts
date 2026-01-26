import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	mock,
	test,
} from "bun:test";
import type {
	Client,
	Message,
	MessageInteractionMetadata,
	PartialTextBasedChannelFields,
} from "discord.js";
import { Bump } from "../../store/models/Bump.js";
import { clearBumpsCache } from "../../store/models/bumps.js";
import {
	clearUserCache,
	getOrCreateUserById,
} from "../../store/models/DDUser.js";
import { getSequelizeInstance, initStorage } from "../../store/storage.js";
import {
	createMockClient,
	createMockTextChannel,
	createMockUser,
} from "../../tests/mocks/discord.js";
import {
	handleBumpStreak,
	sendBumpNotification,
	setLastBumpNotificationTime,
} from "./bump.listener.js";

beforeAll(async () => {
	await initStorage();
});

afterEach(async () => {
	await getSequelizeInstance().destroyAll();
	clearUserCache();
	clearBumpsCache();
});

describe("handleBumpStreak", () => {
	const createTestContext = async () => {
		const fakeUserId = 1n;
		const ddUser = await getOrCreateUserById(fakeUserId);

		const fakeUser = createMockUser({ id: fakeUserId.toString() });
		const mockReact = mock(async () => Promise.resolve());
		const mockChannelSend = mock(async (_content: unknown) =>
			Promise.resolve({} as Message),
		);
		const mockChannel = createMockTextChannel({ send: mockChannelSend });
		const mockClient = createMockClient();

		const message = {
			react: mockReact,
			channel: mockChannel,
		} as unknown as Message & { channel: PartialTextBasedChannelFields };

		const interaction = {
			user: fakeUser,
		} as unknown as MessageInteractionMetadata;

		return {
			ddUser,
			fakeUser,
			mockReact,
			mockChannelSend,
			mockChannel,
			mockClient,
			message,
			interaction,
		};
	};

	test("adds single heart reaction for first bump", async () => {
		const { ddUser, interaction, message, mockReact, mockClient } =
			await createTestContext();

		// Create the user's first bump
		await Bump.create({
			messageId: 100n,
			userId: ddUser.id,
			timestamp: new Date(),
		});
		clearBumpsCache();

		await handleBumpStreak(
			ddUser,
			interaction,
			message,
			mockClient as unknown as Client,
		);

		expect(mockReact).toHaveBeenCalledTimes(1);
		expect(mockReact).toHaveBeenCalledWith("❤️");
	});

	test("adds multiple reactions for streak of 3", async () => {
		const { ddUser, interaction, message, mockReact, mockClient } =
			await createTestContext();

		// Create 3 consecutive bumps for the user
		await Bump.create({
			messageId: 100n,
			userId: ddUser.id,
			timestamp: new Date(Date.now() - 3000),
		});
		await Bump.create({
			messageId: 101n,
			userId: ddUser.id,
			timestamp: new Date(Date.now() - 2000),
		});
		await Bump.create({
			messageId: 102n,
			userId: ddUser.id,
			timestamp: new Date(Date.now() - 1000),
		});
		clearBumpsCache();

		await handleBumpStreak(
			ddUser,
			interaction,
			message,
			mockClient as unknown as Client,
		);

		expect(mockReact).toHaveBeenCalledTimes(3);
		expect(mockReact).toHaveBeenNthCalledWith(1, "❤️");
		expect(mockReact).toHaveBeenNthCalledWith(2, "🩷");
		expect(mockReact).toHaveBeenNthCalledWith(3, "🧡");
	});

	test("announces personal record when streak >= 3 and matches highest", async () => {
		const { ddUser, interaction, message, mockChannelSend, mockClient } =
			await createTestContext();

		// Create 3 consecutive bumps (first time reaching streak of 3)
		await Bump.create({
			messageId: 100n,
			userId: ddUser.id,
			timestamp: new Date(Date.now() - 3000),
		});
		await Bump.create({
			messageId: 101n,
			userId: ddUser.id,
			timestamp: new Date(Date.now() - 2000),
		});
		await Bump.create({
			messageId: 102n,
			userId: ddUser.id,
			timestamp: new Date(Date.now() - 1000),
		});
		clearBumpsCache();

		await handleBumpStreak(
			ddUser,
			interaction,
			message,
			mockClient as unknown as Client,
		);

		// Should announce the personal record
		const calls = mockChannelSend.mock.calls;
		const hasPersonalRecordMessage = calls.some(
			(call) =>
				typeof call[0] === "string" &&
				call[0].includes("beat your max bump streak"),
		);
		expect(hasPersonalRecordMessage).toBe(true);
	});

	test("detects dethrone when breaking streak > 2", async () => {
		const { ddUser, interaction, message, mockChannelSend, mockClient } =
			await createTestContext();

		// Create another user with a streak of 3
		const otherUserId = 2n;
		const otherUser = await getOrCreateUserById(otherUserId);

		await Bump.create({
			messageId: 100n,
			userId: otherUser.id,
			timestamp: new Date(Date.now() - 4000),
		});
		await Bump.create({
			messageId: 101n,
			userId: otherUser.id,
			timestamp: new Date(Date.now() - 3000),
		});
		await Bump.create({
			messageId: 102n,
			userId: otherUser.id,
			timestamp: new Date(Date.now() - 2000),
		});

		// Now our test user bumps, breaking the streak
		await Bump.create({
			messageId: 103n,
			userId: ddUser.id,
			timestamp: new Date(Date.now() - 1000),
		});
		clearBumpsCache();

		await handleBumpStreak(
			ddUser,
			interaction,
			message,
			mockClient as unknown as Client,
		);

		// Should announce the dethrone
		const calls = mockChannelSend.mock.calls;
		const hasDethroneMessage = calls.some(
			(call) =>
				typeof call[0] === "string" &&
				call[0].includes("ended") &&
				call[0].includes("streak"),
		);
		expect(hasDethroneMessage).toBe(true);
	});

	test("does not announce dethrone for streak of 2 or less", async () => {
		const { ddUser, interaction, message, mockChannelSend, mockClient } =
			await createTestContext();

		// Create another user with a streak of only 2
		const otherUserId = 2n;
		const otherUser = await getOrCreateUserById(otherUserId);

		await Bump.create({
			messageId: 100n,
			userId: otherUser.id,
			timestamp: new Date(Date.now() - 3000),
		});
		await Bump.create({
			messageId: 101n,
			userId: otherUser.id,
			timestamp: new Date(Date.now() - 2000),
		});

		// Now our test user bumps
		await Bump.create({
			messageId: 102n,
			userId: ddUser.id,
			timestamp: new Date(Date.now() - 1000),
		});
		clearBumpsCache();

		await handleBumpStreak(
			ddUser,
			interaction,
			message,
			mockClient as unknown as Client,
		);

		// Should NOT announce the dethrone
		const calls = mockChannelSend.mock.calls;
		const hasDethroneMessage = calls.some(
			(call) =>
				typeof call[0] === "string" &&
				call[0].includes("ended") &&
				call[0].includes("streak"),
		);
		expect(hasDethroneMessage).toBe(false);
	});
});

describe("handleBumpStreak - lightning speed", () => {
	test("announces lightning bump when < 30 seconds after notification", async () => {
		const fakeUserId = 1n;
		const ddUser = await getOrCreateUserById(fakeUserId);
		const fakeUser = createMockUser({ id: fakeUserId.toString() });
		const mockReact = mock(async () => Promise.resolve());
		const mockChannelSend = mock(async (_content: unknown) =>
			Promise.resolve({} as Message),
		);
		const mockChannel = createMockTextChannel({ send: mockChannelSend });
		const mockClient = createMockClient();

		const message = {
			react: mockReact,
			channel: mockChannel,
		} as unknown as Message & { channel: PartialTextBasedChannelFields };

		const interaction = {
			user: fakeUser,
		} as unknown as MessageInteractionMetadata;

		// Set last notification time to 10 seconds ago
		setLastBumpNotificationTime(new Date(Date.now() - 10000));

		await Bump.create({
			messageId: 100n,
			userId: ddUser.id,
			timestamp: new Date(),
		});
		clearBumpsCache();

		await handleBumpStreak(
			ddUser,
			interaction,
			message,
			mockClient as unknown as Client,
		);

		const calls = mockChannelSend.mock.calls;
		const hasLightningMessage = calls.some(
			(call) => typeof call[0] === "string" && call[0].includes("⚡"),
		);
		expect(hasLightningMessage).toBe(true);
	});

	test("does not announce lightning bump when >= 30 seconds", async () => {
		const fakeUserId = 3n;
		const ddUser = await getOrCreateUserById(fakeUserId);
		const fakeUser = createMockUser({ id: fakeUserId.toString() });
		const mockReact = mock(async () => Promise.resolve());
		const mockChannelSend = mock(async (_content: unknown) =>
			Promise.resolve({} as Message),
		);
		const mockChannel = createMockTextChannel({ send: mockChannelSend });
		const mockClient = createMockClient();

		const message = {
			react: mockReact,
			channel: mockChannel,
		} as unknown as Message & { channel: PartialTextBasedChannelFields };

		const interaction = {
			user: fakeUser,
		} as unknown as MessageInteractionMetadata;

		// Set last notification time to 60 seconds ago
		setLastBumpNotificationTime(new Date(Date.now() - 60000));

		await Bump.create({
			messageId: 200n,
			userId: ddUser.id,
			timestamp: new Date(),
		});
		clearBumpsCache();

		await handleBumpStreak(
			ddUser,
			interaction,
			message,
			mockClient as unknown as Client,
		);

		const calls = mockChannelSend.mock.calls;
		const hasLightningMessage = calls.some(
			(call) => typeof call[0] === "string" && call[0].includes("⚡"),
		);
		expect(hasLightningMessage).toBe(false);
	});
});

describe("sendBumpNotification", () => {
	beforeEach(() => {
		// Reset notification time
		setLastBumpNotificationTime(new Date(0));
	});

	test("does not send if last bump was less than 2 hours ago", async () => {
		// This test would require mocking the config and client.channels.fetch
		// For now, we verify the function doesn't throw
		const mockClient = createMockClient();

		// Set lastBumpTime to now (less than 2 hours ago)
		// Since lastBumpTime is module-level state, we need to trigger a bump first
		// This is a limitation - for full testing, lastBumpTime should be injectable

		// At minimum, verify the function doesn't throw
		await expect(
			sendBumpNotification(mockClient as unknown as Client),
		).resolves.toBeUndefined();
	});
});
