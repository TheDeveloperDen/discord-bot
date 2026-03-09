import { describe, expect, test } from "bun:test";
import {
	chunkEmbedFieldValues,
	EMBED_FIELD_VALUE_LIMIT,
	formatEmojiForEmbed,
} from "./reactionStats.embed.js";

describe("chunkEmbedFieldValues", () => {
	test("returns one chunk when all lines fit", () => {
		const chunks = chunkEmbedFieldValues(["one", "two", "three"], 1024);
		expect(chunks).toHaveLength(1);
		expect(chunks[0]).toBe("one\n\ntwo\n\nthree");
	});

	test("splits output when a field would exceed the max length", () => {
		const lineA = "a".repeat(700);
		const lineB = "b".repeat(700);

		const chunks = chunkEmbedFieldValues([lineA, lineB], 1024);
		expect(chunks).toHaveLength(2);
		expect(chunks[0]).toBe(lineA);
		expect(chunks[1]).toBe(lineB);
	});

	test("truncates a single overlong line to the field limit", () => {
		const longLine = "x".repeat(EMBED_FIELD_VALUE_LIMIT + 200);

		const chunks = chunkEmbedFieldValues([longLine], EMBED_FIELD_VALUE_LIMIT);
		expect(chunks).toHaveLength(1);
		expect(chunks[0].length).toBe(EMBED_FIELD_VALUE_LIMIT);
		expect(chunks[0].endsWith("...")).toBe(true);
	});
});

describe("formatEmojiForEmbed", () => {
	test("returns unicode emoji unchanged", () => {
		expect(formatEmojiForEmbed("👍", false, null)).toBe("👍");
	});

	test("renders local custom emoji mention when resolvable", () => {
		expect(
			formatEmojiForEmbed("disco_doggo", true, 123456789n, {
				canRenderCustomEmoji: true,
			}),
		).toBe("<:disco_doggo:123456789>");
	});

	test("returns external fallback with image link when custom emoji is unresolved", () => {
		expect(
			formatEmojiForEmbed("disco_doggo", true, 123456789n, {
				canRenderCustomEmoji: false,
			}),
		).toBe(
			"`:disco_doggo:` ([image](https://cdn.discordapp.com/emojis/123456789.webp?size=32&quality=lossless), external)",
		);
	});

	test("returns external fallback for custom alias without id", () => {
		expect(formatEmojiForEmbed(":disco_doggo:", false, null)).toBe(
			"`:disco_doggo:` (external)",
		);
	});
});
