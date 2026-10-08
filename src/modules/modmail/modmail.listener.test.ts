import { afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import { ChannelType, type Client, type Message, type User } from "discord.js";
import { config } from "../../Config.js";
import { ModMailTicketCategory } from "../../store/models/ModMailTicket.js";
import { getSequelizeInstance, initStorage } from "../../store/storage.js";
import { createMockUser } from "../../tests/mocks/discord.js";
import { MODMAIL_CATEGORY_SELECT_ID, MODMAIL_SUBMIT_ID } from "./modmail.js";
import { ModMailListener } from "./modmail.listener.js";

beforeAll(async () => {
	await initStorage();
});

afterEach(async () => {
	await getSequelizeInstance().destroyAll();
});

describe("ModMailListener", () => {
	test("relays an opening DM captured after pending category state already exists", async () => {
		const user = {
			...createMockUser({ id: "123456789", tag: "testuser#0000" }),
			displayName: "testuser",
			displayAvatarURL: () => "https://example.com/avatar.png",
		} as unknown as User;
		const dmSend = mock(async (_payload: unknown) => ({}) as Message);
		const dmChannel = {
			isDMBased: () => true,
			isSendable: () => true,
			send: dmSend,
		};
		const openingMessage = {
			author: user,
			content: "Opening context",
			attachments: [],
			channel: dmChannel,
		} as unknown as Message;
		const threadSend = mock(async (_payload: unknown) => ({}) as Message);
		const thread = {
			id: "987654321",
			joined: true,
			send: threadSend,
		};
		const modmailChannel = {
			type: ChannelType.GuildText,
			isTextBased: () => true,
			threads: {
				create: mock(async () => thread),
			},
		};
		const client = {
			guilds: {
				fetch: mock(async () => ({
					channels: {
						fetch: mock(async (channelId: string) =>
							channelId === config.modmail.channel ? modmailChannel : null,
						),
					},
				})),
			},
		} as unknown as Client;
		const listener = ModMailListener[0];

		await listener.interactionCreate?.(client, {
			customId: MODMAIL_CATEGORY_SELECT_ID,
			values: [ModMailTicketCategory.BUG],
			user,
			channel: dmChannel,
			isButton: () => false,
			isStringSelectMenu: () => true,
			isUserSelectMenu: () => false,
			isModalSubmit: () => false,
			deferUpdate: mock(async () => {}),
		} as never);
		await listener.messageCreate?.(client, openingMessage as never);
		await listener.interactionCreate?.(client, {
			customId: MODMAIL_SUBMIT_ID,
			user,
			channel: dmChannel,
			message: {
				delete: mock(async () => {}),
			},
			isButton: () => true,
			isStringSelectMenu: () => false,
			isUserSelectMenu: () => false,
			isModalSubmit: () => false,
			deferUpdate: mock(async () => {}),
			followUp: mock(async () => {}),
		} as never);

		expect(threadSend).toHaveBeenCalledTimes(2);
		expect(threadSend.mock.calls[0]?.[0]).toMatchObject({
			components: expect.any(Array),
		});
		expect(threadSend.mock.calls[1]?.[0]).toMatchObject({
			embeds: [
				{
					data: {
						description: "Opening context",
					},
				},
			],
		});
		expect(dmSend).toHaveBeenLastCalledWith({
			content:
				"Your ticket has been created successfully! A member of staff will follow up soon. You can add more context or information at any time by simply sending another message here.",
			embeds: expect.any(Array),
			components: expect.any(Array),
		});
	});
});
