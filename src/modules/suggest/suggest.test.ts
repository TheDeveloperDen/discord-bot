import { afterEach, describe, expect, mock, test } from "bun:test";
import type { Client, Message, TextBasedChannel, User } from "discord.js";
import { PermissionFlagsBits } from "discord.js";
import { config } from "../../Config.js";
import { Suggestion, SuggestionStatus } from "../../store/models/Suggestion.js";
import { SuggestionVote } from "../../store/models/SuggestionVote.js";
import { getSequelizeInstance } from "../../store/storage.js";
import { createMockUser } from "../../tests/mocks/discord.js";
import {
	removeSuggestionVotesForMember,
	removeSuggestionVotesForMembers,
} from "./suggest.js";
import { SyncSuggestionVotesCommand } from "./syncSuggestionVotes.command.js";

afterEach(async () => {
	await getSequelizeInstance().destroyAll();
});

function createTestUser(id: string): User {
	return {
		...createMockUser({ id }),
		avatarURL: () => null,
	} as unknown as User;
}

function getFieldValue(
	editPayload: {
		embeds: Array<{
			data?: {
				fields?: Array<{
					name?: string;
					value?: string;
				}>;
			};
			fields?: Array<{
				name?: string;
				value?: string;
			}>;
			toJSON?: () => {
				fields?: Array<{
					name?: string;
					value?: string;
				}>;
			};
		}>;
	},
	fieldName: string,
): string {
	const embed = editPayload.embeds[0];
	const fields =
		embed?.toJSON?.().fields ?? embed?.data?.fields ?? embed?.fields;
	const field = fields?.find((candidate) => candidate.name === fieldName);
	expect(field).toBeDefined();
	return field?.value ?? "";
}

describe("removeSuggestionVotesForMember", () => {
	test("removes banned user votes and refreshes live and archived suggestions", async () => {
		const bannedUserId = 999n;
		const liveEditPayloads: Array<{
			embeds: Array<{
				fields?: Array<{
					name?: string;
					value?: string;
				}>;
			}>;
		}> = [];
		const archivedEditPayloads: Array<{
			embeds: Array<{
				fields?: Array<{
					name?: string;
					value?: string;
				}>;
			}>;
		}> = [];
		const liveEdit = mock(
			async (payload: {
				embeds: Array<{
					data?: {
						fields?: Array<{
							name?: string;
							value?: string;
						}>;
					};
					toJSON?: () => {
						fields?: Array<{
							name?: string;
							value?: string;
						}>;
					};
				}>;
			}) => {
				const embed = payload.embeds[0];
				liveEditPayloads.push({
					embeds: [embed?.toJSON?.() ?? embed?.data ?? embed ?? {}],
				});
				return {};
			},
		);
		const archivedEdit = mock(
			async (payload: {
				embeds: Array<{
					data?: {
						fields?: Array<{
							name?: string;
							value?: string;
						}>;
					};
					toJSON?: () => {
						fields?: Array<{
							name?: string;
							value?: string;
						}>;
					};
				}>;
			}) => {
				const embed = payload.embeds[0];
				archivedEditPayloads.push({
					embeds: [embed?.toJSON?.() ?? embed?.data ?? embed ?? {}],
				});
				return {};
			},
		);

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

		const liveFieldValue = getFieldValue(
			liveEditPayloads[0] as {
				embeds: Array<{
					data: {
						fields?: Array<{
							name?: string;
							value?: string;
						}>;
					};
				}>;
			},
			"Results",
		);
		expect(liveFieldValue).toMatch(/:white_check_mark:: \*\*0\*\*/);
		expect(liveFieldValue).toMatch(/:x:: \*\*1\*\*/);

		const archivedFieldValue = getFieldValue(
			archivedEditPayloads[0] as {
				embeds: Array<{
					data: {
						fields?: Array<{
							name?: string;
							value?: string;
						}>;
					};
				}>;
			},
			"Results",
		);
		expect(archivedFieldValue).toMatch(/:white_check_mark:: \*\*1\*\*/);
		expect(archivedFieldValue).toMatch(/:x:: \*\*0\*\*/);
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

describe("SyncSuggestionVotesCommand", () => {
	test("rejects non-admin users", async () => {
		const reply = mock(async (_payload: unknown) => ({}));

		await SyncSuggestionVotesCommand.handle({
			isChatInputCommand: () => true,
			inGuild: () => true,
			guild: {
				bans: {
					fetch: mock(async () => new Map()),
				},
			},
			member: {
				permissions: {
					has: () => false,
				},
			},
			reply,
		} as never);

		expect(reply).toHaveBeenCalledTimes(1);
		expect((reply.mock.calls[0][0] as { content: string }).content).toContain(
			"don't have permission",
		);
	});

	test("sweeps existing bans and reports the cleanup summary", async () => {
		const bannedUserId = 777n;
		const suggestionEdit = mock(async (_payload: unknown) => ({}));
		const suggestionMessage = {
			id: "4001",
			editable: true,
			edit: suggestionEdit,
		} as unknown as Message;
		const suggestionChannel = {
			id: config.suggest.suggestionsChannel,
			isTextBased: () => true,
			messages: {
				fetch: mock(async (messageId: string) => {
					if (messageId === suggestionMessage.id) {
						return suggestionMessage;
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
			id: 4n,
			memberId: 404n,
			suggestionText: "Banned user cleanup",
			messageId: BigInt(suggestionMessage.id),
			status: SuggestionStatus.PENDING,
		});
		await SuggestionVote.bulkCreate([
			{
				suggestionId: 4n,
				memberId: bannedUserId,
				vote: 1,
			},
			{
				suggestionId: 4n,
				memberId: 778n,
				vote: -1,
			},
		]);

		const deferReply = mock(async (_payload: unknown) => ({}));
		const editReply = mock(async (_payload: unknown) => ({}));

		await SyncSuggestionVotesCommand.handle({
			isChatInputCommand: () => true,
			inGuild: () => true,
			guild: {
				bans: {
					fetch: mock(async () => new Map([[bannedUserId.toString(), {}]])),
				},
			},
			member: {
				permissions: {
					has: (permission: bigint) =>
						permission === PermissionFlagsBits.Administrator,
				},
			},
			client,
			deferReply,
			editReply,
		} as never);

		expect(deferReply).toHaveBeenCalledTimes(1);
		expect(editReply).toHaveBeenCalledTimes(1);
		expect(
			(editReply.mock.calls[0][0] as { content: string }).content,
		).toContain(
			"Scanned 1 banned user(s). Removed 1 vote(s) from 1 user(s). Refreshed 1 suggestion message(s).",
		);
		expect(
			await SuggestionVote.count({
				where: {
					memberId: bannedUserId,
				},
			}),
		).toBe(0);
		expect(suggestionEdit).toHaveBeenCalledTimes(1);
	});
});
