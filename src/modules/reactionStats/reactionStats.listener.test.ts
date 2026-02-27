import { afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import type { Client, MessageReaction, PartialUser, User } from "discord.js";
import {
	clearUserCache,
	getOrCreateUserById,
} from "../../store/models/DDUser.js";
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
		// Ensure DDUser exists for FK constraints
		await getOrCreateUserById(10n);
		await getOrCreateUserById(200n);

		const reaction = createMockReaction();

		await handler(mockClient, reaction, user);

		const count = await ReactionStat.count();
		expect(count).toBe(1);

		const record = await ReactionStat.findOne({ where: { userId: 10n } });
		expect(record).toBeDefined();
		expect(record?.messageId.toString()).toBe("100");
		expect(record?.messageAuthorId.toString()).toBe("200");
		expect(record?.channelId.toString()).toBe("500");
		expect(record?.emojiName).toBe("👍");
		expect(record?.isCustomEmoji).toBe(false);
		expect(record?.emojiId).toBeNull();
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
		await getOrCreateUserById(10n);
		await getOrCreateUserById(200n);

		const reaction = createMockReaction();

		await handler(mockClient, reaction, user);
		await handler(mockClient, reaction, user);

		const count = await ReactionStat.count();
		expect(count).toBe(1);
	});

	test("allows same user to react with different emojis on same message", async () => {
		const user = createMockUser({ id: "10" });
		await getOrCreateUserById(10n);
		await getOrCreateUserById(200n);

		await handler(mockClient, createMockReaction({ emojiName: "👍" }), user);
		await handler(mockClient, createMockReaction({ emojiName: "❤️" }), user);

		const count = await ReactionStat.count();
		expect(count).toBe(2);
	});

	test("saves custom emoji correctly", async () => {
		const user = createMockUser({ id: "10" });
		await getOrCreateUserById(10n);
		await getOrCreateUserById(200n);

		const reaction = createMockReaction({
			emojiName: "pepe",
			emojiId: "999888777",
		});

		await handler(mockClient, reaction, user);

		const record = await ReactionStat.findOne({ where: { userId: 10n } });
		expect(record).toBeDefined();
		expect(record?.emojiName).toBe("pepe");
		expect(record?.isCustomEmoji).toBe(true);
		expect(record?.emojiId?.toString()).toBe("999888777");
	});

	test("fetches partial reactions before processing", async () => {
		const user = createMockUser({ id: "10" });
		await getOrCreateUserById(10n);
		await getOrCreateUserById(200n);

		const reaction = createMockReaction({ partial: true });

		await handler(mockClient, reaction, user);

		expect(reaction.fetch).toHaveBeenCalledTimes(1);
		const count = await ReactionStat.count();
		expect(count).toBe(1);
	});

	test("stores reactedAt timestamp", async () => {
		const user = createMockUser({ id: "10" });
		await getOrCreateUserById(10n);
		await getOrCreateUserById(200n);

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
