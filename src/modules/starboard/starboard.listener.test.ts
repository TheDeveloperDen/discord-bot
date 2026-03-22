import { describe, expect, test } from "bun:test";
import {
	getReactionCountForEmoji,
	getThresholdReactionCount,
	matchesConfiguredEmoji,
} from "./starboard.reaction-utils.js";
import { createMessageWithReactions } from "./starboard.test-utils.js";

describe("matchesConfiguredEmoji", () => {
	test("matches unicode emoji with and without variation selector", () => {
		expect(matchesConfiguredEmoji("⭐", null, "⭐️")).toBe(true);
	});

	test("matches custom emoji by id when config uses Discord emoji syntax", () => {
		expect(
			matchesConfiguredEmoji("star", "1234567890", "<:star:1234567890>"),
		).toBe(true);
	});
});

describe("getReactionCountForEmoji", () => {
	test("matches unicode emoji with and without variation selector", () => {
		const message = createMessageWithReactions([
			{
				emoji: {
					name: "⭐",
					id: null,
				},
				count: 3,
			},
		]);

		expect(getReactionCountForEmoji(message, "⭐️")).toBe(3);
	});

	test("matches custom emoji when configured as <:name:id>", () => {
		const message = createMessageWithReactions([
			{
				emoji: {
					name: "star",
					id: "1234567890",
				},
				count: 4,
			},
		]);

		expect(getReactionCountForEmoji(message, "<:star:1234567890>")).toBe(4);
	});
});

describe("getThresholdReactionCount", () => {
	test("uses message reaction count when event count is missing", () => {
		const message = createMessageWithReactions([
			{
				emoji: {
					name: "⭐",
					id: null,
				},
				count: 2,
			},
		]);

		expect(getThresholdReactionCount(message, "⭐", null)).toBe(2);
	});

	test("falls back to event reaction count when message cache has no match", () => {
		const message = createMessageWithReactions([]);

		expect(getThresholdReactionCount(message, "⭐", 2)).toBe(2);
	});
});
