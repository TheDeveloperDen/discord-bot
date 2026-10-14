import { afterEach, describe, expect, mock, test } from "bun:test";
import type { Client, Message, TextBasedChannel, User } from "discord.js";
import { config } from "../../Config.js";
import { Suggestion, SuggestionStatus } from "../../store/models/Suggestion.js";
import { SuggestionVote } from "../../store/models/SuggestionVote.js";
import { getSequelizeInstance } from "../../store/storage.js";
import { createMockUser } from "../../tests/mocks/discord.js";
import {
	refreshSuggestionMessage,
	removeSuggestionVotesForMember,
	removeSuggestionVotesForMembers,
} from "./suggest.js";

afterEach(async () => {
	await getSequelizeInstance().destroyAll();
});

function createTestUser(id: string): User {
	return {
		...createMockUser({ id }),
		avatarURL: () => null,
		displayAvatarURL: () => `https://cdn.discordapp.com/embed/avatars/0.png`,
	} as unknown as User;
}

/** All the text in a Components V2 payload, nested components included */
function textOf(payload: unknown): string {
	const texts: string[] = [];
	const walk = (node: unknown) => {
		if (Array.isArray(node)) return node.forEach(walk);
		if (!node || typeof node !== "object") return;
		const { content, components } = node as Record<string, unknown>;
		if (typeof content === "string") texts.push(content);
		walk(components);
	};
	walk((payload as { components?: unknown }).components);
	return texts.join("\n");
}

describe("removeSuggestionVotesForMember", () => {
	test("removes banned user votes and refreshes live and archived suggestions", async () => {
		const bannedUserId = 999n;
		const liveEditPayloads: unknown[] = [];
		const archivedEditPayloads: unknown[] = [];
		const liveEdit = mock(async (payload: unknown) => {
			liveEditPayloads.push(payload);
			return {};
		});
		const archivedEdit = mock(async (payload: unknown) => {
			archivedEditPayloads.push(payload);
			return {};
		});

		const liveMessage = {
			id: "2001",
			editable: true,
			edit: liveEdit,
		} as unknown as Message;
		const archivedMessage = {
			id: "2002",
			editable: true,
			edit: archivedEdit,
		} as unknown as Message;

		const liveChannel = {
			id: config.suggest.suggestionsChannel,
			isTextBased: () => true,
			messages: {
				fetch: mock(async (messageId: string) => {
					if (messageId === liveMessage.id) {
						return liveMessage;
					}
					throw new Error("Message not found");
				}),
			},
		} as unknown as TextBasedChannel;
		const archiveChannel = {
			id: config.suggest.archiveChannel,
			isTextBased: () => true,
			messages: {
				fetch: mock(async (messageId: string) => {
					if (messageId === archivedMessage.id) {
						return archivedMessage;
					}
					throw new Error("Message not found");
				}),
			},
		} as unknown as TextBasedChannel;

		const client = {
			channels: {
				fetch: mock(async (channelId: string) => {
					if (channelId === config.suggest.suggestionsChannel) {
						return liveChannel;
					}
					if (channelId === config.suggest.archiveChannel) {
						return archiveChannel;
					}
					return null;
				}),
			},
			users: {
				fetch: mock(async (userResolvable: string | { id: string }) => {
					const id =
						typeof userResolvable === "string"
							? userResolvable
							: userResolvable.id;
					return createTestUser(id);
				}),
			},
		} as unknown as Client;

		await Suggestion.create({
			id: 1n,
			memberId: 101n,
			suggestionText: "Live suggestion",
			messageId: BigInt(liveMessage.id),
			status: SuggestionStatus.PENDING,
		});
		await Suggestion.create({
			id: 2n,
			memberId: 202n,
			suggestionText: "Archived suggestion",
			messageId: BigInt(archivedMessage.id),
			status: SuggestionStatus.APPROVED,
			moderatorId: 303n,
		});

		await SuggestionVote.bulkCreate([
			{
				suggestionId: 1n,
				memberId: bannedUserId,
				vote: 1,
			},
			{
				suggestionId: 1n,
				memberId: 111n,
				vote: -1,
			},
			{
				suggestionId: 2n,
				memberId: bannedUserId,
				vote: -1,
			},
			{
				suggestionId: 2n,
				memberId: 222n,
				vote: 1,
			},
		]);

		const result = await removeSuggestionVotesForMember(client, bannedUserId);

		expect(result).toEqual({
			removedVotes: 2,
			updatedSuggestions: 2,
		});
		expect(
			await SuggestionVote.count({
				where: {
					memberId: bannedUserId,
				},
			}),
		).toBe(0);
		expect(
			await SuggestionVote.count({
				where: {
					suggestionId: 1n,
					vote: 1,
				},
			}),
		).toBe(0);
		expect(
			await SuggestionVote.count({
				where: {
					suggestionId: 2n,
					vote: -1,
				},
			}),
		).toBe(0);

		expect(liveEdit).toHaveBeenCalledTimes(1);
		expect(archivedEdit).toHaveBeenCalledTimes(1);

		// the live suggestion is pending, so it shows its votes; the archived one shows its results
		expect(textOf(liveEditPayloads[0])).toContain(
			"**Votes**\n:white_check_mark: **0** · :x: **1**",
		);
		expect(textOf(archivedEditPayloads[0])).toContain(
			"**Results**\n:white_check_mark: **1** · :x: **0**",
		);
	});
});

describe("removeSuggestionVotesForMembers", () => {
	test("removes votes for multiple banned users in one pass", async () => {
		const messageEdit = mock(async (_payload: unknown) => ({}));
		const message = {
			id: "3001",
			editable: true,
			edit: messageEdit,
		} as unknown as Message;
		const suggestionChannel = {
			id: config.suggest.suggestionsChannel,
			isTextBased: () => true,
			messages: {
				fetch: mock(async (messageId: string) => {
					if (messageId === message.id) {
						return message;
					}
					throw new Error("Message not found");
				}),
			},
		} as unknown as TextBasedChannel;
		const archiveChannel = {
			id: config.suggest.archiveChannel,
			isTextBased: () => true,
			messages: {
				fetch: mock(async () => {
					throw new Error("Message not found");
				}),
			},
		} as unknown as TextBasedChannel;

		const client = {
			channels: {
				fetch: mock(async (channelId: string) => {
					if (channelId === config.suggest.suggestionsChannel) {
						return suggestionChannel;
					}
					if (channelId === config.suggest.archiveChannel) {
						return archiveChannel;
					}
					return null;
				}),
			},
			users: {
				fetch: mock(async (userResolvable: string | { id: string }) => {
					const id =
						typeof userResolvable === "string"
							? userResolvable
							: userResolvable.id;
					return createTestUser(id);
				}),
			},
		} as unknown as Client;

		await Suggestion.create({
			id: 3n,
			memberId: 303n,
			suggestionText: "Shared suggestion",
			messageId: BigInt(message.id),
			status: SuggestionStatus.PENDING,
		});

		await SuggestionVote.bulkCreate([
			{
				suggestionId: 3n,
				memberId: 900n,
				vote: 1,
			},
			{
				suggestionId: 3n,
				memberId: 901n,
				vote: -1,
			},
			{
				suggestionId: 3n,
				memberId: 902n,
				vote: 1,
			},
		]);

		const result = await removeSuggestionVotesForMembers(client, [900n, 901n]);

		expect(result).toEqual({
			removedVotes: 2,
			updatedSuggestions: 1,
			affectedMembers: 2,
		});
		expect(
			await SuggestionVote.count({
				where: {
					suggestionId: 3n,
				},
			}),
		).toBe(1);
		expect(messageEdit).toHaveBeenCalledTimes(1);
	});
});

describe("refreshSuggestionMessage", () => {
	test("keeps the moderator's reason and the thread link stored on the suggestion", async () => {
		const edit = mock(async (_payload: unknown) => ({}));
		const message = { id: "5001", editable: true, edit } as unknown as Message;
		const archive = {
			id: config.suggest.archiveChannel,
			isTextBased: () => true,
			messages: { fetch: async () => message },
		} as unknown as TextBasedChannel;
		const client = {
			users: { fetch: async (id: string) => createTestUser(id) },
		} as unknown as Client;
		const suggestion = await Suggestion.create({
			id: 21n,
			memberId: 1n,
			suggestionText: "t",
			messageId: 5001n,
		});
		suggestion.status = SuggestionStatus.APPROVED;
		suggestion.moderatorId = 2n;
		suggestion.reason = "good idea";
		suggestion.threadUrl = "https://discord.com/channels/g/t";
		await suggestion.save();

		const reloaded = await Suggestion.findByPk(21n, {
			include: [SuggestionVote],
		});
		if (!reloaded) throw new Error("suggestion missing");
		await refreshSuggestionMessage(client, reloaded, [archive]);

		const text = textOf(edit.mock.calls[0]?.[0]);
		expect(text).toContain("**Approved** by <@2>");
		expect(text).toContain("**Reason**\ngood idea");
		expect(text).toContain(
			"**Discussion**\n[View the discussion thread](https://discord.com/channels/g/t)",
		);
	});
});

describe("refreshing a suggestion decided before reasons were stored", () => {
	test("saves the reason and thread link from its old embed, then shows them", async () => {
		const edit = mock(async (_payload: unknown) => ({}));
		const message = {
			id: "6001",
			editable: true,
			edit,
			embeds: [
				{
					fields: [
						{ name: "Status", value: "**APPROVED**" },
						{ name: "Reason", value: "we already planned this" },
						{
							name: "Discussion Thread",
							value: "[View Discussion](https://discord.com/channels/g/t)",
						},
					],
				},
			],
		} as unknown as Message;
		const archive = {
			id: config.suggest.archiveChannel,
			isTextBased: () => true,
			messages: { fetch: async () => message },
		} as unknown as TextBasedChannel;
		const client = {
			users: { fetch: async (id: string) => createTestUser(id) },
		} as unknown as Client;
		const suggestion = await Suggestion.create({
			id: 31n,
			memberId: 1n,
			suggestionText: "t",
			messageId: 6001n,
		});
		suggestion.status = SuggestionStatus.APPROVED;
		await suggestion.save();

		const loaded = await Suggestion.findByPk(31n, {
			include: [SuggestionVote],
		});
		if (!loaded) throw new Error("suggestion missing");
		await refreshSuggestionMessage(client, loaded, [archive]);

		const saved = await Suggestion.findByPk(31n);
		expect(saved?.reason).toBe("we already planned this");
		expect(saved?.threadUrl).toBe("https://discord.com/channels/g/t");
		expect(textOf(edit.mock.calls[0]?.[0])).toContain(
			"**Reason**\nwe already planned this",
		);
	});
});

describe("Suggestion model", () => {
	test("loads the stored status rather than the default", async () => {
		await Suggestion.create({
			id: 11n,
			memberId: 1n,
			suggestionText: "t",
			messageId: 11n,
			status: SuggestionStatus.APPROVED,
		});
		await Suggestion.create({
			id: 12n,
			memberId: 1n,
			suggestionText: "t",
			messageId: 12n,
		});

		expect((await Suggestion.findByPk(11n))?.status).toBe(
			SuggestionStatus.APPROVED,
		);
		expect((await Suggestion.findByPk(12n))?.status).toBe(
			SuggestionStatus.PENDING,
		);
	});
});
