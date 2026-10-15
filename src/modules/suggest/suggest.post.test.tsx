import { describe, expect, test } from "bun:test";
import { type Client, ComponentType, MessageFlags } from "discord.js";
import { Suggestion, SuggestionStatus } from "../../store/models/Suggestion.js";
import {
	SUGGESTION_NO_ID,
	SUGGESTION_VIEW_VOTES_ID,
	SUGGESTION_YES_ID,
} from "./suggest.constants.js";
import { renderSuggestion, suggestionView } from "./suggest.post.js";

// a submitter who has left the server, so they're shown from their account
const client = {
	users: {
		fetch: async (id: string) => ({
			id,
			username: "alice",
			displayAvatarURL: () => "https://cdn/alice.png",
		}),
	},
} as unknown as Client;

const suggestion = (fields: Partial<Suggestion>) => {
	const built = Suggestion.build({
		id: 1300000000000000001n,
		memberId: 10n,
		suggestionText: "Add a #rust channel",
		messageId: 1n,
		...fields,
	});
	built.votes = [{ vote: 1 }, { vote: 1 }, { vote: -1 }] as never;
	return built;
};

type Node = {
	type: number;
	content?: string;
	custom_id?: string;
	accent_color?: number;
	components?: Node[];
};
const textOf = (nodes: Node[] = []): string[] =>
	nodes.flatMap((n) => [
		...(n.content ? [n.content] : []),
		...textOf(n.components),
	]);

describe("renderSuggestion", () => {
	test("renders a pending suggestion with its votes and the vote buttons", async () => {
		const payload = await renderSuggestion(
			client,
			suggestionView(suggestion({})),
		);

		expect(payload.flags).toBe(MessageFlags.IsComponentsV2);
		const [card, row] = payload.components as [Node, Node];
		expect(card.type).toBe(ComponentType.Container);
		expect(textOf(card.components)).toEqual(
			expect.arrayContaining([
				"<@10>",
				"Add a #rust channel",
				"**Pending**",
				"**Votes**\n:white_check_mark: **2** · :x: **1**",
			]),
		);
		expect(row.components?.map((button) => button.custom_id)).toEqual([
			SUGGESTION_YES_ID,
			SUGGESTION_NO_ID,
			SUGGESTION_VIEW_VOTES_ID,
		]);
	});

	test("renders a decided suggestion with its moderator, reason and thread, and only the view votes button", async () => {
		const payload = await renderSuggestion(
			client,
			suggestionView(
				suggestion({
					status: SuggestionStatus.REJECTED,
					moderatorId: 20n,
					reason: "already exists",
					threadUrl: "https://discord.com/channels/g/t",
				}),
			),
		);

		const [card, row] = payload.components as [Node, Node];
		expect(card.accent_color).toBe(0xed4245);
		expect(textOf(card.components)).toEqual(
			expect.arrayContaining([
				"**Rejected** by <@20>",
				"**Results**\n:white_check_mark: **2** · :x: **1**",
				"**Reason**\nalready exists",
				"**Discussion**\n[View the discussion thread](https://discord.com/channels/g/t)",
			]),
		);
		expect(row.components?.map((button) => button.custom_id)).toEqual([
			SUGGESTION_VIEW_VOTES_ID,
		]);
	});

	test("keeps a long suggestion within Discord's text limit", async () => {
		const payload = await renderSuggestion(
			client,
			suggestionView(
				suggestion({
					suggestionText: "a".repeat(5000),
					reason: "b".repeat(2000),
				}),
			),
		);

		const [card] = payload.components as [Node];
		expect(textOf(card.components).join("").length).toBeLessThanOrEqual(4000);
	});
});
