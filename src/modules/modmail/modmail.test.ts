import { describe, expect, mock, test } from "bun:test";
import type {
	ButtonInteraction,
	ChatInputCommandInteraction,
} from "discord.js";
import {
	handleArchivedModmailShowNotes,
	handleModmailAddNote,
	handleModmailShowNotes,
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
