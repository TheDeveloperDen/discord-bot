import { describe, expect, test } from "bun:test";
import { config } from "../../Config.js";
import {
	buildStarboardMessageContent,
	type StarboardContentRenderOptions,
} from "./starboard.content.js";
import { createMessageWithUrlAndReactions } from "./starboard.test-utils.js";

const starboardRenderOptions: StarboardContentRenderOptions = {
	emojiId: config.starboard.emojiId,
	threshold: config.starboard.threshold,
	color: config.starboard.color,
};

describe("buildStarboardMessageContent", () => {
	test("includes an anti-star hint when normal starboard score was reduced", () => {
		const antiStarboard = config.antiStarboard;
		if (!antiStarboard) {
			throw new Error("antiStarboard config is required for this test");
		}

		const message = createMessageWithUrlAndReactions(
			"https://discord.test/message",
			[
				{
					emoji: {
						name: antiStarboard.emojiId,
						id: null,
					},
					count: 2,
				},
			],
		);

		expect(
			buildStarboardMessageContent(message, 5, starboardRenderOptions),
		).toBe(
			`${config.starboard.emojiId}: 5 (- ${antiStarboard.emojiId}: 2) | https://discord.test/message`,
		);
	});

	test("omits the anti-star hint when there are no anti-stars", () => {
		const message = createMessageWithUrlAndReactions(
			"https://discord.test/message",
			[],
		);

		expect(
			buildStarboardMessageContent(message, 3, starboardRenderOptions),
		).toBe(`${config.starboard.emojiId}: 3 | https://discord.test/message`);
	});

	test("does not add anti-star hint to anti-starboard posts", () => {
		const antiStarboard = config.antiStarboard;
		if (!antiStarboard) {
			throw new Error("antiStarboard config is required for this test");
		}

		const message = createMessageWithUrlAndReactions(
			"https://discord.test/message",
			[
				{
					emoji: {
						name: antiStarboard.emojiId,
						id: null,
					},
					count: 2,
				},
			],
		);

		expect(
			buildStarboardMessageContent(message, 2, {
				emojiId: antiStarboard.emojiId,
				threshold: antiStarboard.threshold,
				color: antiStarboard.color,
			}),
		).toBe(`${antiStarboard.emojiId}: 2 | https://discord.test/message`);
	});
});
