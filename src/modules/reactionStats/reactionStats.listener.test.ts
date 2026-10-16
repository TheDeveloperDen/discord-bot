import { afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import {
	type Client,
	type Guild,
	type MessageReaction,
	type PartialUser,
	ReactionType,
	type TextBasedChannel,
	type User,
} from "discord.js";
import { clearUserCache, DDUser } from "../../store/models/DDUser.js";
import { DDUserAchievements } from "../../store/models/DDUserAchievements.js";
import { ReactionStat } from "../../store/models/ReactionStat.js";
import { getSequelizeInstance, initStorage } from "../../store/storage.js";
import {
	createMockClient,
	createMockGuild,
	createMockGuildMember,
	createMockTextChannel,
	createMockUser,
} from "../../tests/mocks/discord.js";
import { ReactionStatsListener } from "./reactionStats.listener.js";

beforeAll(async () => {
	await initStorage();
});

afterEach(async () => {
	await getSequelizeInstance().destroyAll();
	clearUserCache();
});

function createMockReaction(
	overrides?: Partial<{
		messageId: string;
		messageAuthorId: string;
		channelId: string;
		emojiName: string | null;
		emojiId: string | null;
		partial: boolean;
		messagePartial: boolean;
		authorBot: boolean;
		authorSystem: boolean;
		inGuild: boolean;
		guild: Guild;
		channel: TextBasedChannel;
	}>,
): MessageReaction {
	const messageId = overrides?.messageId ?? "100";
	const authorId = overrides?.messageAuthorId ?? "200";
	const channelId = overrides?.channelId ?? "500";

	const message = {
		id: messageId,
		partial: overrides?.messagePartial ?? false,
		channelId,
		inGuild: () => overrides?.inGuild ?? true,
		author: {
			id: authorId,
			bot: overrides?.authorBot ?? false,
			system: overrides?.authorSystem ?? false,
		},
		guild: overrides?.guild,
		channel:
			overrides?.channel ??
			createMockTextChannel({
				id: channelId,
			}),
		fetch: mock(async () => message),
	};

	const reaction = {
		partial: overrides?.partial ?? false,
		emoji: {
			name: overrides?.emojiName ?? "👍",
			id: overrides?.emojiId ?? null,
		},
		message,
		fetch: mock(async () => reaction),
	};

	return reaction as unknown as MessageReaction;
}

describe("ReactionStatsListener.messageReactionAdd", () => {
	const listener = ReactionStatsListener.messageReactionAdd;
	if (!listener) throw new Error("messageReactionAdd handler not defined");
	const handler = (
		client: Client,
		reaction: MessageReaction,
		user: User | PartialUser,
	) =>
		listener(client, reaction, user, {
			type: ReactionType.Normal,
			burst: false,
		});
	const mockClient = createMockClient() as unknown as Client;

	test("saves a reaction stat to the database", async () => {
		const user = createMockUser({ id: "10" });
		const reaction = createMockReaction();

		await handler(mockClient, reaction, user);

		const count = await ReactionStat.count();
		expect(count).toBe(1);

		const record = await ReactionStat.findOne({ where: { userId: 10n } });
		expect(record).toBeDefined();
		expect(record?.messageId).toBe(100n);
		expect(record?.messageAuthorId).toBe(200n);
		expect(record?.channelId).toBe(500n);
		expect(record?.emojiName).toBe("👍");
		expect(record?.isCustomEmoji).toBe(false);
		expect(record?.emojiId).toBeNull();

		const [reactorUser, messageAuthor] = await Promise.all([
			DDUser.findByPk(10n),
			DDUser.findByPk(200n),
		]);
		expect(reactorUser).toBeDefined();
		expect(messageAuthor).toBeDefined();
	});

	test("ignores bot users", async () => {
		const botUser = createMockUser({ id: "10", bot: true });
		const reaction = createMockReaction();

		await handler(mockClient, reaction, botUser);

		const count = await ReactionStat.count();
		expect(count).toBe(0);
	});

	test("ignores null user", async () => {
		const reaction = createMockReaction();

		await handler(mockClient, reaction, null as unknown as User | PartialUser);

		const count = await ReactionStat.count();
		expect(count).toBe(0);
	});

	test("resolves partial reactors before excluding bot reactions", async () => {
		const resolvedBot = createMockUser({ id: "10", bot: true });
		const partialReactor = {
			id: "10",
			partial: true,
			fetch: mock(async () => resolvedBot),
		} as unknown as PartialUser;

		await handler(mockClient, createMockReaction(), partialReactor);

		expect(partialReactor.fetch).toHaveBeenCalledTimes(1);
		expect(await ReactionStat.count()).toBe(0);
	});

	test("ignores reactions on bot messages", async () => {
		const user = createMockUser({ id: "10" });
		const reaction = createMockReaction({ authorBot: true });

		await handler(mockClient, reaction, user);

		const count = await ReactionStat.count();
		expect(count).toBe(0);
	});

	test("ignores reactions outside guild", async () => {
		const user = createMockUser({ id: "10" });
		const reaction = createMockReaction({ inGuild: false });

		await handler(mockClient, reaction, user);

		const count = await ReactionStat.count();
		expect(count).toBe(0);
	});

	test("does not create duplicate for same user+message+emoji", async () => {
		const user = createMockUser({ id: "10" });
		const reaction = createMockReaction();

		await handler(mockClient, reaction, user);
		await handler(mockClient, reaction, user);

		const count = await ReactionStat.count();
		expect(count).toBe(1);
	});

	test("allows same user to react with different emojis on same message", async () => {
		const user = createMockUser({ id: "10" });
		await handler(mockClient, createMockReaction({ emojiName: "👍" }), user);
		await handler(mockClient, createMockReaction({ emojiName: "❤️" }), user);

		const count = await ReactionStat.count();
		expect(count).toBe(2);
	});

	test("saves custom emoji correctly", async () => {
		const user = createMockUser({ id: "10" });
		const reaction = createMockReaction({
			emojiName: "pepe",
			emojiId: "999888777",
		});

		await handler(mockClient, reaction, user);

		const record = await ReactionStat.findOne({ where: { userId: 10n } });
		expect(record).toBeDefined();
		expect(record?.emojiName).toBe("pepe");
		expect(record?.isCustomEmoji).toBe(true);
		expect(record?.emojiId).toBe(999888777n);
	});

	test("allows custom emojis with same name but different ids", async () => {
		const user = createMockUser({ id: "10" });

		await handler(
			mockClient,
			createMockReaction({ emojiName: "pepe", emojiId: "111" }),
			user,
		);
		await handler(
			mockClient,
			createMockReaction({ emojiName: "pepe", emojiId: "222" }),
			user,
		);

		const count = await ReactionStat.count();
		expect(count).toBe(2);
	});

	test("does not duplicate custom emoji when id matches", async () => {
		const user = createMockUser({ id: "10" });

		await handler(
			mockClient,
			createMockReaction({ emojiName: "pepe", emojiId: "111" }),
			user,
		);
		await handler(
			mockClient,
			createMockReaction({ emojiName: "renamed", emojiId: "111" }),
			user,
		);

		const count = await ReactionStat.count();
		expect(count).toBe(1);
	});

	test("fetches partial reactions before processing", async () => {
		const user = createMockUser({ id: "10" });
		const reaction = createMockReaction({ partial: true });

		await handler(mockClient, reaction, user);

		expect(reaction.fetch).toHaveBeenCalledTimes(1);
		const count = await ReactionStat.count();
		expect(count).toBe(1);
	});

	test("stores reactedAt timestamp", async () => {
		const user = createMockUser({ id: "10" });
		const before = new Date();
		const reaction = createMockReaction();
		await handler(mockClient, reaction, user);
		const after = new Date();

		const record = await ReactionStat.findOne({ where: { userId: 10n } });
		expect(record).toBeDefined();
		expect(record?.reactedAt.getTime()).toBeGreaterThanOrEqual(
			before.getTime(),
		);
		expect(record?.reactedAt.getTime()).toBeLessThanOrEqual(after.getTime());
	});

	test("awards Broad Appeal once to the message author at 25 distinct reactors", async () => {
		const author = createMockUser({ id: "200" });
		author.displayAvatarURL = () => "https://example.test/avatar.png";
		const recipient = createMockGuildMember({ id: "200", user: author });
		const guild = createMockGuild({
			members: new Map([["200", recipient]]),
		});
		const channel = createMockTextChannel();

		for (let i = 1; i <= 24; i++) {
			await handler(
				mockClient,
				createMockReaction({
					messageId: String(100 + ((i - 1) % 4)),
					guild,
					channel,
				}),
				createMockUser({ id: String(i) }),
			);
		}

		expect(
			await DDUserAchievements.count({
				where: { achievementId: "broad_appeal", ddUserId: 200n },
			}),
		).toBe(0);

		const thresholdReaction = createMockReaction({
			messageId: "104",
			guild,
			channel,
		});
		await handler(mockClient, thresholdReaction, createMockUser({ id: "25" }));
		await handler(mockClient, thresholdReaction, createMockUser({ id: "25" }));

		expect(
			await DDUserAchievements.count({
				where: { achievementId: "broad_appeal", ddUserId: 200n },
			}),
		).toBe(1);
		expect(guild.members.fetch).toHaveBeenCalledTimes(1);
		expect(guild.members.fetch).toHaveBeenCalledWith("200");
	});

	test("requires a fifth distinct message even with 25 distinct reactors", async () => {
		for (let i = 1; i <= 25; i++) {
			await handler(
				mockClient,
				createMockReaction({
					messageId: String(100 + ((i - 1) % 4)),
				}),
				createMockUser({ id: String(i) }),
			);
		}

		expect(
			await DDUserAchievements.count({
				where: { achievementId: "broad_appeal", ddUserId: 200n },
			}),
		).toBe(0);

		await handler(
			mockClient,
			createMockReaction({ messageId: "104" }),
			createMockUser({ id: "1" }),
		);

		expect(
			await DDUserAchievements.count({
				where: { achievementId: "broad_appeal", ddUserId: 200n },
			}),
		).toBe(1);
	});

	test("does not award Broad Appeal for self-only reaction history", async () => {
		for (let messageId = 100; messageId < 105; messageId++) {
			await handler(
				mockClient,
				createMockReaction({ messageId: String(messageId) }),
				createMockUser({ id: "200" }),
			);
		}

		expect(await ReactionStat.count({ where: { userId: 200n } })).toBe(5);

		expect(
			await DDUserAchievements.count({
				where: { achievementId: "broad_appeal", ddUserId: 200n },
			}),
		).toBe(0);
	});
});
