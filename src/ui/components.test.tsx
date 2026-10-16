import { describe, expect, test } from "bun:test";
import { ButtonStyle, ComponentType, type GuildMember } from "discord.js";
import { Message, renderDiscordMessage } from "disjsx";
import {
	ConfirmButtons,
	Field,
	memberAuthor,
	Quote,
	withoutPings,
} from "./index.js";

const components = (children: React.ReactElement) =>
	renderDiscordMessage(<Message isV2>{children}</Message>)
		.components as unknown as Record<string, unknown>[];

describe("Field", () => {
	test("renders the label in bold above the value", () => {
		expect(components(<Field label="Status">Approved</Field>)).toEqual([
			{ type: ComponentType.TextDisplay, content: "**Status**\nApproved" },
		]);
	});
});

describe("Quote", () => {
	test("quotes every line and attributes it, linked when there's a url", () => {
		expect(
			components(
				<Quote author="Bob" url="https://discord.com/channels/g/c/1">
					{"first\nsecond"}
				</Quote>,
			),
		).toEqual([
			{
				type: ComponentType.TextDisplay,
				content:
					"Replying to **[Bob](https://discord.com/channels/g/c/1)**\n> first\n> second",
			},
		]);
	});
});

describe("ConfirmButtons", () => {
	test("renders a confirm and a cancel button", () => {
		const [row] = components(
			<ConfirmButtons confirmId="set:confirm" cancelId="set:cancel" />,
		) as [{ components: Record<string, unknown>[] }];
		expect(row.components).toEqual([
			expect.objectContaining({
				style: ButtonStyle.Success,
				custom_id: "set:confirm",
				label: "Confirm",
			}),
			expect.objectContaining({
				style: ButtonStyle.Danger,
				custom_id: "set:cancel",
				label: "Cancel",
			}),
		]);
	});
});

describe("memberAuthor", () => {
	test("mentions the member, with their server avatar", () => {
		const member = {
			id: "1",
			displayName: "Alice (server nick)",
			displayAvatarURL: () => "https://cdn/server-avatar.png",
		} as unknown as GuildMember;
		expect(memberAuthor(member)).toEqual({
			name: "Alice (server nick)",
			iconUrl: "https://cdn/server-avatar.png",
			userId: "1",
		});
	});
});

describe("withoutPings", () => {
	test("keeps the payload and parses no mentions", () => {
		const payload = withoutPings({ content: "hi <@1>" });
		expect(payload).toEqual({
			content: "hi <@1>",
			allowedMentions: { parse: [] },
		});
	});
});
