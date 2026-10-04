import { describe, expect, mock, test } from "bun:test";
import {
	type ButtonInteraction,
	type Client,
	Collection,
	type EmbedBuilder,
	type Message,
} from "discord.js";
import {
	ModMailTicket,
	ModMailTicketCategory,
	ModMailTicketStatus,
} from "../../store/models/ModMailTicket.js";
import {
	assignModMailTicket,
	closeModMailTicketByModMail,
	handleModmailAssign,
	rememberModMailDetailsMessage,
} from "./modmail.js";

const creatorId = BigInt("100000000000000101");
const moderatorId = BigInt("100000000000000102");
const threadId = "100000000000000103";
const detailsMessageId = "100000000000000104";
const userDetailsMessageId = "100000000000000106";
const botId = "100000000000000105";

function createClient(
	ticketId: number,
	onEdit: (payload: unknown) => Promise<void> = async () => {},
) {
	const edit = mock(onEdit);
	const userEdit = mock(async (_payload: unknown) => {});
	const title = `Modmail Ticket #${ticketId} -  Rooki`;
	const detailsMessage = {
		id: detailsMessageId,
		author: { id: botId },
		embeds: [{ title }],
		edit,
	} as unknown as Message<true>;
	const userDetailsMessage = {
		id: userDetailsMessageId,
		author: { id: botId },
		embeds: [{ title }],
		edit: userEdit,
	} as unknown as Message;
	const fetchMessages = mock(async (options: string | { after?: string }) => {
		if (typeof options === "string") {
			return detailsMessage;
		}
		return new Collection([[detailsMessage.id, detailsMessage]]);
	});
	const fetchUserMessages = mock(
		async (options: string | { limit?: number }) => {
			if (typeof options === "string") {
				return userDetailsMessage;
			}
			return new Collection([[userDetailsMessage.id, userDetailsMessage]]);
		},
	);
	const thread = {
		id: threadId,
		isThread: () => true,
		messages: { fetch: fetchMessages },
	};
	const fetchChannel = mock(async () => thread);
	const client = {
		user: { id: botId },
		guilds: {
			fetch: mock(async () => ({ channels: { fetch: fetchChannel } })),
		},
		users: {
			fetch: mock(async () => ({
				displayName: "Rooki",
				createDM: async () => ({
					messages: { fetch: fetchUserMessages },
				}),
			})),
		},
	} as unknown as Client;

	return {
		client,
		detailsMessage,
		edit,
		fetchMessages,
		fetchUserMessages,
		userDetailsMessage,
		userEdit,
	};
}

function getEditedEmbed(edit: ReturnType<typeof mock>) {
	const payload = edit.mock.calls[0]?.[0] as {
		embeds: EmbedBuilder[];
		components: unknown[];
	};
	return { payload, embed: payload.embeds[0]?.toJSON() };
}

describe("ModMail ticket state embeds", () => {
	test("assignment updates the original embed and records it for legacy tickets", async () => {
		const ticket = await ModMailTicket.create({
			creatorId,
			threadId: BigInt(threadId),
			category: ModMailTicketCategory.QUESTION,
			status: ModMailTicketStatus.OPEN,
		});
		const { client, edit, fetchMessages, fetchUserMessages, userEdit } =
			createClient(ticket.id);

		try {
			await assignModMailTicket(client, ticket, moderatorId);
			await ticket.reload();

			expect(ticket.assignedUserId).toBe(moderatorId);
			expect(JSON.parse(ticket.detailsMessageIds ?? "{}")).toEqual({
				moderator: detailsMessageId,
				creator: userDetailsMessageId,
			});
			expect(fetchMessages).toHaveBeenCalledWith({
				after: threadId,
				cache: false,
				limit: 100,
			});
			expect(fetchUserMessages).toHaveBeenCalledWith({
				cache: false,
				limit: 100,
			});
			const { payload, embed } = getEditedEmbed(edit);
			expect(embed?.fields).toContainEqual({
				name: "Assigned Moderator",
				value: `<@${moderatorId}>`,
				inline: true,
			});
			expect(embed?.fields).toContainEqual({
				name: "Status",
				value: ModMailTicketStatus.OPEN,
				inline: true,
			});
			expect(payload.components).toHaveLength(1);
			const { payload: userPayload, embed: userEmbed } =
				getEditedEmbed(userEdit);
			expect(userEmbed?.fields).toContainEqual({
				name: "Assigned Moderator",
				value: `<@${moderatorId}>`,
				inline: true,
			});
			expect(userPayload.components).toHaveLength(1);
		} finally {
			await ticket.destroy({ force: true });
		}
	});

	test("closure updates the stored embed and removes obsolete actions", async () => {
		const ticket = await ModMailTicket.create({
			creatorId,
			threadId: BigInt(threadId),
			detailsMessageIds: JSON.stringify({
				moderator: detailsMessageId,
				creator: userDetailsMessageId,
			}),
			category: ModMailTicketCategory.QUESTION,
			status: ModMailTicketStatus.OPEN,
		});
		const { client, edit, fetchMessages, fetchUserMessages, userEdit } =
			createClient(ticket.id);

		try {
			await closeModMailTicketByModMail(ticket, client);
			await ticket.reload();

			expect(ticket.status).toBe(ModMailTicketStatus.ARCHIVED);
			expect(fetchMessages).toHaveBeenCalledWith(detailsMessageId);
			expect(fetchUserMessages).toHaveBeenCalledWith(userDetailsMessageId);
			const { payload, embed } = getEditedEmbed(edit);
			expect(embed?.fields).toContainEqual({
				name: "Status",
				value: ModMailTicketStatus.ARCHIVED,
				inline: true,
			});
			expect(payload.components).toEqual([]);
			const { payload: userPayload, embed: userEmbed } =
				getEditedEmbed(userEdit);
			expect(userEmbed?.fields).toContainEqual({
				name: "Status",
				value: ModMailTicketStatus.ARCHIVED,
				inline: true,
			});
			expect(userPayload.components).toEqual([]);
		} finally {
			await ticket.destroy({ force: true });
		}
	});

	test("preserves both details message IDs during concurrent registration", async () => {
		const ticket = await ModMailTicket.create({
			creatorId,
			threadId: BigInt(threadId),
			category: ModMailTicketCategory.QUESTION,
			status: ModMailTicketStatus.OPEN,
		});

		try {
			await Promise.all([
				rememberModMailDetailsMessage(ticket, "moderator", detailsMessageId),
				rememberModMailDetailsMessage(ticket, "creator", userDetailsMessageId),
			]);
			await ticket.reload();

			expect(JSON.parse(ticket.detailsMessageIds ?? "{}")).toEqual({
				moderator: detailsMessageId,
				creator: userDetailsMessageId,
			});
		} finally {
			await ticket.destroy({ force: true });
		}
	});

	test("serializes concurrent assignment and closure before editing the embed", async () => {
		const state = {
			assignedUserId: undefined as bigint | undefined,
			status: ModMailTicketStatus.OPEN,
		};
		const createTicketInstance = () => {
			const ticket = {
				id: 999,
				creatorId,
				threadId: BigInt(threadId),
				detailsMessageIds: JSON.stringify({
					moderator: detailsMessageId,
					creator: userDetailsMessageId,
				}),
				category: ModMailTicketCategory.QUESTION,
				assignedUserId: state.assignedUserId,
				status: state.status,
				reload: mock(async () => {
					ticket.assignedUserId = state.assignedUserId;
					ticket.status = state.status;
					return ticket;
				}),
				update: mock(
					async (values: {
						assignedUserId?: bigint;
						status?: ModMailTicketStatus;
					}) => {
						if (values.assignedUserId !== undefined) {
							state.assignedUserId = values.assignedUserId;
							ticket.assignedUserId = values.assignedUserId;
						}
						if (values.status !== undefined) {
							state.status = values.status;
							ticket.status = values.status;
						}
						return ticket;
					},
				),
			};
			return ticket;
		};
		const assignmentTicket = createTicketInstance() as unknown as ModMailTicket;
		const closureTicket = createTicketInstance() as unknown as ModMailTicket;
		let releaseFirstEdit: (() => void) | undefined;
		const firstEditStarted = new Promise<void>((resolve) => {
			releaseFirstEdit = resolve;
		});
		let editCount = 0;
		const completedPayloads: unknown[] = [];
		let unblockFirstEdit: (() => void) | undefined;
		const firstEditCanFinish = new Promise<void>((resolve) => {
			unblockFirstEdit = resolve;
		});
		const { client } = createClient(999, async (payload) => {
			editCount += 1;
			if (editCount === 1) {
				releaseFirstEdit?.();
				await firstEditCanFinish;
			}
			completedPayloads.push(payload);
		});

		const assignment = assignModMailTicket(
			client,
			assignmentTicket,
			moderatorId,
		);
		await firstEditStarted;
		const closure = closeModMailTicketByModMail(closureTicket, client);

		expect(closureTicket.update).not.toHaveBeenCalled();

		unblockFirstEdit?.();
		await Promise.all([assignment, closure]);

		expect(state.status).toBe(ModMailTicketStatus.ARCHIVED);
		const finalPayload = completedPayloads.at(-1) as {
			embeds: EmbedBuilder[];
			components: unknown[];
		};
		expect(finalPayload.embeds[0]?.toJSON().fields).toContainEqual({
			name: "Status",
			value: ModMailTicketStatus.ARCHIVED,
			inline: true,
		});
		expect(finalPayload.components).toEqual([]);
	});
});

describe("ModMail assignment permissions", () => {
	test("allows moderators through the Assign button permission gate", async () => {
		const followUp = mock(async (_payload: unknown) => {});
		const interaction = {
			deferReply: mock(async () => {}),
			inGuild: () => true,
			member: { permissions: { has: () => true } },
			channel: { isThread: () => false },
			followUp,
		} as unknown as ButtonInteraction;

		await handleModmailAssign(interaction);

		expect(followUp.mock.calls).toHaveLength(1);
		expect(followUp.mock.calls[0]?.[0]).toMatchObject({
			content: "This command can only be used in a modmail thread.",
		});
	});

	test("rejects members without moderator permissions", async () => {
		const followUp = mock(async (_payload: unknown) => {});
		const interaction = {
			deferReply: mock(async () => {}),
			inGuild: () => true,
			member: { permissions: { has: () => false } },
			followUp,
		} as unknown as ButtonInteraction;

		await handleModmailAssign(interaction);

		expect(followUp.mock.calls).toHaveLength(1);
		expect(followUp.mock.calls[0]?.[0]).toMatchObject({
			content: "You don't have permission to assign tickets.",
		});
	});
});
