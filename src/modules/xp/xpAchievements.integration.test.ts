import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import type {
	ChatInputCommandInteraction,
	GuildMember,
	TextChannel,
} from "discord.js";
import {
	clearUserCache,
	getOrCreateUserById,
} from "../../store/models/DDUser.js";
import { DDUserAchievements } from "../../store/models/DDUserAchievements.js";
import { getSequelizeInstance, initStorage } from "../../store/storage.js";
import {
	createMockClient,
	createMockGuildMember,
	createMockTextChannel,
	createMockUser,
} from "../../tests/mocks/discord.js";
import { DailyRewardCommand } from "./dailyReward.command.js";
import {
	evaluateLevelAchievements,
	giveXp,
	xpForLevel,
} from "./xpForMessage.util.js";

const levelAchievementIds = ["level_5", "level_10", "level_25", "level_50"];

beforeAll(async () => {
	await initStorage();
});

afterEach(async () => {
	await getSequelizeInstance().destroyAll();
	clearUserCache();
});

function createMember(id: string): GuildMember {
	const user = createMockUser({ id });
	Object.assign(user, { displayAvatarURL: () => null });
	return createMockGuildMember({
		id,
		user,
		client: createMockClient(),
	});
}

async function persistAtLevel(member: GuildMember, level: number) {
	const ddUser = await getOrCreateUserById(BigInt(member.id));
	ddUser.xp = xpForLevel(level);
	ddUser.level = level;
	await ddUser.save();
	return ddUser;
}

async function earnedLevelAchievementIds(
	member: GuildMember,
): Promise<string[]> {
	const achievements = await DDUserAchievements.findAll({
		where: { ddUserId: BigInt(member.id) },
	});
	return achievements
		.map((achievement) => achievement.achievementId)
		.filter((id) => levelAchievementIds.includes(id));
}

async function expectLevelAchievementMembership(
	member: GuildMember,
	expectedIds: readonly string[],
): Promise<void> {
	const actualIds = await earnedLevelAchievementIds(member);

	expect(actualIds).toHaveLength(expectedIds.length);
	for (const expectedId of expectedIds) {
		expect(actualIds).toContain(expectedId);
	}
}

interface DailyInteractionFixture {
	member: GuildMember;
	channel: TextChannel;
	deferReply(): Promise<void>;
	followUp(payload: unknown): Promise<void>;
}

/**
 * DailyRewardCommand is coupled to Discord's large interaction type. This is the
 * narrow test boundary: only the members it consumes are represented above.
 */
function asDailyInteraction(
	fixture: DailyInteractionFixture,
): ChatInputCommandInteraction {
	return fixture as unknown as ChatInputCommandInteraction;
}

describe("level achievements", () => {
	test("awards every milestone when directly evaluating a persisted high-level user", async () => {
		const member = createMember("101");
		const ddUser = await persistAtLevel(member, 50);

		await evaluateLevelAchievements(member, ddUser, createMockTextChannel());

		await expectLevelAchievementMembership(member, levelAchievementIds);
	});

	test("does not duplicate milestones on subsequent shared XP grants", async () => {
		const member = createMember("102");
		await persistAtLevel(member, 50);
		const channel = createMockTextChannel();

		await giveXp(member, 1, channel);
		await giveXp(member, 1, channel);

		await expectLevelAchievementMembership(member, levelAchievementIds);
	});

	test("catches up an existing high-level user through the shared XP path", async () => {
		const member = createMember("103");
		await persistAtLevel(member, 50);

		await giveXp(member, 1, createMockTextChannel());

		await expectLevelAchievementMembership(member, levelAchievementIds);
	});

	test("evaluates daily XP through the shared XP path", async () => {
		const member = createMember("104");
		await persistAtLevel(member, 5);
		const interaction = asDailyInteraction({
			member,
			channel: createMockTextChannel(),
			deferReply: async () => {},
			followUp: async () => {},
		});

		await DailyRewardCommand.handle(interaction);

		await expectLevelAchievementMembership(member, ["level_5"]);
	});

	test("preserves a completed XP grant when achievement notification fails", async () => {
		const member = createMember("105");
		await persistAtLevel(member, 5);
		const failingChannel = createMockTextChannel({
			send: async () => {
				throw new Error("notification unavailable");
			},
		});

		const result = await giveXp(member, 1, failingChannel);
		const ddUser = await getOrCreateUserById(BigInt(member.id));

		expect(result.xpGiven).toBe(1);
		expect(ddUser.xp).toBe(xpForLevel(5) + 1n);
		await expectLevelAchievementMembership(member, ["level_5"]);
	});
});
