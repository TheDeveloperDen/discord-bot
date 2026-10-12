import { describe, expect, mock, test } from "bun:test";
import {
	type ButtonInteraction,
	type ChatInputCommandInteraction,
	EmbedBuilder,
} from "discord.js";
import {
	ModMailTicket,
	ModMailTicketCategory,
	ModMailTicketStatus,
} from "../../store/models/ModMailTicket.js";
import { createMockUser } from "../../tests/mocks/discord.js";
import {
	handleArchivedModmailShowNotes,
	handleModmailAddNote,
	handleModmailShowNotes,
	handleModmailUserDetails,
	showModmailNotes,
} from "./modmail.js";

function createUnauthorizedInteraction() {
	const deferReply = mock(async (_options: unknown) => {});
	const followUp = mock(async (_options: unknown) => {});
	const isThread = mock(() => false);
	const interaction = {
		inGuild: () => true,
		member: {
			permissions: {
				has: () => false,
			},
		},
		deferReply,
		followUp,
		channel: { isThread },
		channelId: "123",
		customId: "modmail-list-notes-archived-456",
	};

	return {
		interaction,
		deferReply,
		followUp,
		isThread,
	};
}

describe("modmail note permissions", () => {
	test("stops an unauthorized Add Note interaction before examining the ticket", async () => {
		const { interaction, deferReply, followUp, isThread } =
			createUnauthorizedInteraction();

		await handleModmailAddNote(interaction as unknown as ButtonInteraction);

		expect(deferReply).toHaveBeenCalledTimes(1);
		expect(followUp).toHaveBeenCalledTimes(1);
		expect(followUp.mock.calls[0]?.[0]).toMatchObject({
			content: "You don't have permission to add notes.",
		});
		expect(isThread).not.toHaveBeenCalled();
	});

	test("stops an unauthorized active List Notes interaction before examining the ticket", async () => {
		const { interaction, deferReply, followUp, isThread } =
			createUnauthorizedInteraction();

		await handleModmailShowNotes(interaction as unknown as ButtonInteraction);

		expect(deferReply).toHaveBeenCalledTimes(1);
		expect(followUp).toHaveBeenCalledTimes(1);
		expect(followUp.mock.calls[0]?.[0]).toMatchObject({
			content: "You don't have permission to list notes.",
		});
		expect(isThread).not.toHaveBeenCalled();
	});

	test("stops an unauthorized archived List Notes interaction before loading the ticket", async () => {
		const { interaction, deferReply, followUp, isThread } =
			createUnauthorizedInteraction();

		await handleArchivedModmailShowNotes(
			interaction as unknown as ButtonInteraction,
		);

		expect(deferReply).toHaveBeenCalledTimes(1);
		expect(followUp).toHaveBeenCalledTimes(1);
		expect(followUp.mock.calls[0]?.[0]).toMatchObject({
			content: "You don't have permission to list notes.",
		});
		expect(isThread).not.toHaveBeenCalled();
	});

	test("stops an unauthorized slash List Notes interaction before examining the ticket", async () => {
		const { interaction, followUp, isThread } = createUnauthorizedInteraction();

		await showModmailNotes(
			interaction as unknown as ChatInputCommandInteraction,
		);

		expect(followUp).toHaveBeenCalledTimes(1);
		expect(followUp.mock.calls[0]?.[0]).toMatchObject({
			content: "You don't have permission to list notes.",
		});
		expect(isThread).not.toHaveBeenCalled();
	});
});

describe("modmail user details", () => {
	test("shows status and assigned moderator exactly once", async () => {
		const creatorId = "987654321";
		const ticket = await ModMailTicket.create({
			creatorId: BigInt(creatorId),
			threadId: 123456789n,
			category: ModMailTicketCategory.QUESTION,
			status: ModMailTicketStatus.OPEN,
		});
		const user = Object.assign(createMockUser({ id: creatorId }), {
			displayName: "Ticket Creator",
			displayAvatarURL: () => "https://example.com/avatar.png",
		});
		const followUp = mock(async (_options: unknown) => {});

		try {
			await handleModmailUserDetails({
				deferReply: mock(async (_options: unknown) => {}),
				inGuild: () => false,
				user,
				followUp,
			} as unknown as ButtonInteraction);

			const response = followUp.mock.calls[0]?.[0];
			if (
				!response ||
				typeof response !== "object" ||
				!("embeds" in response) ||
				!Array.isArray(response.embeds)
			) {
				throw new Error("Expected an embed response");
			}
			const embed = response.embeds[0];
			expect(embed).toBeInstanceOf(EmbedBuilder);
			if (!(embed instanceof EmbedBuilder)) {
				throw new Error("Expected an EmbedBuilder");
			}

			const fieldNames = embed.data.fields?.map((field) => field.name) ?? [];
			expect(fieldNames.filter((name) => name === "Status")).toHaveLength(1);
			expect(
				fieldNames.filter((name) => name === "Assigned Moderator"),
			).toHaveLength(1);
		} finally {
			await ticket.destroy();
		}
	});
});
