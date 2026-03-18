import { afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import type { Client, MessageReaction, PartialUser, User } from "discord.js";
import { clearUserCache, DDUser } from "../../store/models/DDUser.js";
import { ReactionStat } from "../../store/models/ReactionStat.js";
import { getSequelizeInstance, initStorage } from "../../store/storage.js";
import { createMockClient, createMockUser } from "../../tests/mocks/discord.js";
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
	const handler = ReactionStatsListener.messageReactionAdd;
	if (!handler) throw new Error("messageReactionAdd handler not defined");
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
});
