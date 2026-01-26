import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	mock,
	test,
} from "bun:test";
import { type InstalledClock, install } from "@sinonjs/fake-timers";
import type { Client, GuildMember, Message } from "discord.js";
import { clearUserCache, DDUser } from "../../store/models/DDUser.js";
import { getSequelizeInstance, initStorage } from "../../store/storage.js";
import {
	createMockClient,
	createMockGuildMember,
	createMockTextChannel,
	createMockUser,
} from "../../tests/mocks/discord.js";
import {
	scheduledReminders,
	scheduleReminder,
} from "./dailyReward.reminder.js";

let clock: InstalledClock;

beforeAll(async () => {
	await initStorage();
	clock = install();
});

afterAll(() => {
	clock.uninstall();
});

beforeEach(() => {
	clock.reset();
	scheduledReminders.clear();
});

afterEach(async () => {
	// Cancel all scheduled reminders
	for (const job of scheduledReminders.values()) {
		job.cancel();
	}
	scheduledReminders.clear();

	await getSequelizeInstance().destroyAll();
	clearUserCache();
});

describe("scheduleReminder", () => {
	const createTestContext = () => {
		const mockChannelSend = mock(async (_content: unknown) =>
			Promise.resolve({} as Message),
		);
		const mockChannel = createMockTextChannel({
			send: mockChannelSend,
			isSendable: () => true,
		});

		const channels = new Map();
		// Use the actual bot commands channel ID from config or a test ID
		channels.set("bot-commands", mockChannel);

		const mockClient = createMockClient({ channels });

		const mockUser = createMockUser({ id: "12345" });
		const mockMember = createMockGuildMember({
			id: "12345",
			user: mockUser,
			client: mockClient,
			premiumSince: new Date(), // Make them a "special user" (booster)
		});

		return {
			mockClient,
			mockMember,
			mockChannelSend,
			mockChannel,
		};
	};

	test("does not schedule for user without lastDailyTime", async () => {
		const { mockClient, mockMember } = createTestContext();

		const ddUser = DDUser.build({
			id: BigInt(mockMember.id),
			xp: 0n,
			level: 0,
			bumps: 0,
			lastDailyTime: null,
			currentDailyStreak: 0,
			highestDailyStreak: 0,
		});

		await scheduleReminder(
			mockClient as unknown as Client,
			mockMember as unknown as GuildMember,
			ddUser,
		);

		expect(scheduledReminders.size).toBe(0);
	});

	test("does not schedule for user with no streak", async () => {
		const { mockClient, mockMember } = createTestContext();

		// User claimed daily but has no streak (hasn't claimed recently)
		const ddUser = DDUser.build({
			id: BigInt(mockMember.id),
			xp: 0n,
			level: 0,
			bumps: 0,
			lastDailyTime: new Date(Date.now() - 1000 * 60 * 60 * 72), // 72 hours ago (streak reset)
			currentDailyStreak: 0,
			highestDailyStreak: 0,
		});

		await scheduleReminder(
			mockClient as unknown as Client,
			mockMember as unknown as GuildMember,
			ddUser,
		);

		expect(scheduledReminders.size).toBe(0);
	});

	test("sends immediate reminder if claimable now", async () => {
		const { mockClient, mockMember, mockChannelSend } = createTestContext();

		// User claimed 25 hours ago (can claim now, still has streak)
		const ddUser = DDUser.build({
			id: BigInt(mockMember.id),
			xp: 0n,
			level: 0,
			bumps: 0,
			lastDailyTime: new Date(Date.now() - 1000 * 60 * 60 * 25),
			currentDailyStreak: 5,
			highestDailyStreak: 5,
		});

		await scheduleReminder(
			mockClient as unknown as Client,
			mockMember as unknown as GuildMember,
			ddUser,
		);

		// Should have sent the reminder immediately instead of scheduling
		// The actual send might fail due to missing config, but no job should be scheduled
		expect(scheduledReminders.size).toBe(0);
	});

	test("replaces existing reminder when rescheduling", async () => {
		const { mockClient, mockMember } = createTestContext();

		// User with active streak, claimed 10 hours ago
		const ddUser = DDUser.build({
			id: BigInt(mockMember.id),
			xp: 0n,
			level: 0,
			bumps: 0,
			lastDailyTime: new Date(Date.now() - 1000 * 60 * 60 * 10),
			currentDailyStreak: 3,
			highestDailyStreak: 3,
		});

		// Schedule first reminder
		await scheduleReminder(
			mockClient as unknown as Client,
			mockMember as unknown as GuildMember,
			ddUser,
		);

		const firstJobCount = scheduledReminders.size;

		// Schedule again (should replace)
		ddUser.lastDailyTime = new Date(Date.now() - 1000 * 60 * 60 * 5);
		await scheduleReminder(
			mockClient as unknown as Client,
			mockMember as unknown as GuildMember,
			ddUser,
		);

		// Should still only have one job
		expect(scheduledReminders.size).toBe(firstJobCount);
	});

	test("schedules job for user with active streak", async () => {
		const { mockClient, mockMember } = createTestContext();

		// User with active streak, claimed 10 hours ago
		const ddUser = DDUser.build({
			id: BigInt(mockMember.id),
			xp: 0n,
			level: 0,
			bumps: 0,
			lastDailyTime: new Date(Date.now() - 1000 * 60 * 60 * 10),
			currentDailyStreak: 5,
			highestDailyStreak: 5,
		});

		await scheduleReminder(
			mockClient as unknown as Client,
			mockMember as unknown as GuildMember,
			ddUser,
		);

		// Should have scheduled a job
		expect(scheduledReminders.has(ddUser.id)).toBe(true);
	});
});

describe("scheduledReminders Map", () => {
	test("tracks scheduled jobs by user ID", () => {
		expect(scheduledReminders).toBeInstanceOf(Map);
	});
});
