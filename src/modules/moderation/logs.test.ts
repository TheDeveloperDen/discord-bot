import { describe, expect, mock, test } from "bun:test";
import type { Client, TextChannel, User } from "discord.js";
import { Colors, type EmbedBuilder } from "discord.js";
import {
	createMockClient,
	createMockTextChannel,
	createMockUser,
} from "../../tests/mocks/discord.js";
import { logModerationAction, type ModerationLog } from "./logs.js";

describe("logModerationAction", () => {
	const createTestContext = () => {
		const mockChannelSend = mock(async (data: { embeds: EmbedBuilder[] }) => {
			return data;
		});
		const mockChannel = {
			...createMockTextChannel({ send: mockChannelSend }),
			isSendable: () => true,
		} as unknown as TextChannel;

		const channels = new Map<string, TextChannel>();
		// The config.channels.modLog ID would be used here
		channels.set("mod-log", mockChannel);

		const mockClient = {
			channels: {
				fetch: mock(async () => mockChannel),
			},
			users: {
				fetch: mock(async (id: string) => createMockUser({ id })),
			},
		} as unknown as Client;

		return {
			mockClient,
			mockChannelSend,
			mockChannel,
		};
	};

	describe("action types", () => {
		test("handles Ban action", async () => {
			const { mockClient, mockChannelSend } = createTestContext();
			const moderator = createMockUser({ id: "12345", username: "mod" });
			const target = createMockUser({ id: "67890", username: "user" });

			const action: ModerationLog = {
				kind: "Ban",
				moderator,
				target,
				deleteMessages: true,
				reason: "Breaking rules",
			};

			await logModerationAction(mockClient, action);

			expect(mockChannelSend).toHaveBeenCalled();
			const callArgs = mockChannelSend.mock.calls[0][0] as {
				embeds: EmbedBuilder[];
			};
			const embed = callArgs.embeds[0];

			expect(embed.data.title).toBe("Member Banned");
			expect(embed.data.color).toBe(Colors.Red);
		});

		test("handles Unban action", async () => {
			const { mockClient, mockChannelSend } = createTestContext();
			const moderator = createMockUser({ id: "12345" });
			const target = createMockUser({ id: "67890" });

			const action: ModerationLog = {
				kind: "Unban",
				moderator,
				target,
				reason: "Appeal accepted",
			};

			await logModerationAction(mockClient, action);

			expect(mockChannelSend).toHaveBeenCalled();
			const callArgs = mockChannelSend.mock.calls[0][0] as {
				embeds: EmbedBuilder[];
			};
			const embed = callArgs.embeds[0];

			expect(embed.data.title).toBe("Member Unbanned");
			expect(embed.data.color).toBe(Colors.Green);
		});

		test("handles TempBan action", async () => {
			const { mockClient, mockChannelSend } = createTestContext();
			const moderator = createMockUser({ id: "12345" });
			const target = createMockUser({ id: "67890" });

			const action: ModerationLog = {
				kind: "TempBan",
				moderator,
				target,
				deleteMessages: false,
				banDuration: 86400000, // 1 day
				reason: "Temporary ban",
			};

			await logModerationAction(mockClient, action);

			expect(mockChannelSend).toHaveBeenCalled();
			const callArgs = mockChannelSend.mock.calls[0][0] as {
				embeds: EmbedBuilder[];
			};
			const embed = callArgs.embeds[0];

			expect(embed.data.title).toBe("Member Tempbanned");
			expect(embed.data.color).toBe(Colors.Orange);
			expect(embed.data.description).toContain("Ban duration");
		});

		test("handles Kick action", async () => {
			const { mockClient, mockChannelSend } = createTestContext();
			const moderator = createMockUser({ id: "12345" });
			const target = createMockUser({ id: "67890" });

			const action: ModerationLog = {
				kind: "Kick",
				moderator,
				target,
				reason: "Being disruptive",
			};

			await logModerationAction(mockClient, action);

			expect(mockChannelSend).toHaveBeenCalled();
			const callArgs = mockChannelSend.mock.calls[0][0] as {
				embeds: EmbedBuilder[];
			};
			const embed = callArgs.embeds[0];

			expect(embed.data.title).toBe("Member Kicked");
			expect(embed.data.color).toBe(Colors.Yellow);
		});

		test("handles SoftBan action", async () => {
			const { mockClient, mockChannelSend } = createTestContext();
			const moderator = createMockUser({ id: "12345" });
			const target = createMockUser({ id: "67890" });

			const action: ModerationLog = {
				kind: "SoftBan",
				moderator,
				target,
				deleteMessages: true,
				reason: "Cleaning up messages",
			};

			await logModerationAction(mockClient, action);

			expect(mockChannelSend).toHaveBeenCalled();
			const callArgs = mockChannelSend.mock.calls[0][0] as {
				embeds: EmbedBuilder[];
			};
			const embed = callArgs.embeds[0];

			expect(embed.data.title).toBe("Member Softbanned");
			expect(embed.data.color).toBe(Colors.DarkOrange);
		});

		test("handles InviteDeleted action", async () => {
			const { mockClient, mockChannelSend } = createTestContext();
			const target = createMockUser({ id: "67890" });

			const action: ModerationLog = {
				kind: "InviteDeleted",
				target,
				messageId: "123456789",
				messageCreatedTimestamp: Date.now(),
				edited: false,
				matches: ["discord.gg/server1", "discord.gg/server2"],
			};

			await logModerationAction(mockClient, action);

			expect(mockChannelSend).toHaveBeenCalled();
			const callArgs = mockChannelSend.mock.calls[0][0] as {
				embeds: EmbedBuilder[];
			};
			const embed = callArgs.embeds[0];

			expect(embed.data.title).toBe("Discord Invite Removed");
			expect(embed.data.color).toBe(Colors.Blurple);
			expect(embed.data.description).toContain("discord.gg/server1");
		});

		test("handles TempBanEnded action", async () => {
			const { mockClient, mockChannelSend } = createTestContext();

			const action: ModerationLog = {
				kind: "TempBanEnded",
				target: "67890",
			};

			await logModerationAction(mockClient, action);

			expect(mockChannelSend).toHaveBeenCalled();
			const callArgs = mockChannelSend.mock.calls[0][0] as {
				embeds: EmbedBuilder[];
			};
			const embed = callArgs.embeds[0];

			expect(embed.data.title).toBe("Tempban Expired");
			expect(embed.data.color).toBe(Colors.DarkGreen);
		});
	});

	describe("embed content", () => {
		test("includes reason when present", async () => {
			const { mockClient, mockChannelSend } = createTestContext();
			const moderator = createMockUser({ id: "12345" });
			const target = createMockUser({ id: "67890" });

			const action: ModerationLog = {
				kind: "Kick",
				moderator,
				target,
				reason: "This is the reason",
			};

			await logModerationAction(mockClient, action);

			const callArgs = mockChannelSend.mock.calls[0][0] as {
				embeds: EmbedBuilder[];
			};
			const embed = callArgs.embeds[0];

			expect(embed.data.description).toContain("This is the reason");
		});

		test("includes moderator when present", async () => {
			const { mockClient, mockChannelSend } = createTestContext();
			const moderator = createMockUser({ id: "12345" });
			const target = createMockUser({ id: "67890" });

			const action: ModerationLog = {
				kind: "Ban",
				moderator,
				target,
				deleteMessages: false,
				reason: null,
			};

			await logModerationAction(mockClient, action);

			const callArgs = mockChannelSend.mock.calls[0][0] as {
				embeds: EmbedBuilder[];
			};
			const embed = callArgs.embeds[0];

			expect(embed.data.description).toContain("Responsible Moderator");
		});

		test("includes delete messages flag when true", async () => {
			const { mockClient, mockChannelSend } = createTestContext();
			const moderator = createMockUser({ id: "12345" });
			const target = createMockUser({ id: "67890" });

			const action: ModerationLog = {
				kind: "Ban",
				moderator,
				target,
				deleteMessages: true,
				reason: null,
			};

			await logModerationAction(mockClient, action);

			const callArgs = mockChannelSend.mock.calls[0][0] as {
				embeds: EmbedBuilder[];
			};
			const embed = callArgs.embeds[0];

			expect(embed.data.description).toContain("Deleted Messages");
		});
	});

	describe("edge cases", () => {
		test("handles missing mod log channel gracefully", async () => {
			const mockClient = {
				channels: {
					fetch: mock(async () => null),
				},
			} as unknown as Client;

			const action: ModerationLog = {
				kind: "Ban",
				moderator: createMockUser({ id: "12345" }),
				target: createMockUser({ id: "67890" }),
				deleteMessages: false,
				reason: null,
			};

			// Should not throw
			await expect(
				logModerationAction(mockClient, action),
			).resolves.toBeUndefined();
		});
	});
});
