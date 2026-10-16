import { describe, expect, test } from "bun:test";
import { fitLines, formatEmojiForEmbed } from "./reactionStats.embed.js";

describe("fitLines", () => {
	test("joins every line when they fit", () => {
		expect(fitLines(["one", "two", "three"], 100)).toBe("one\ntwo\nthree");
	});

	test("uses the separator it's given", () => {
		expect(fitLines(["one", "two"], 100, "\n\n")).toBe("one\n\ntwo");
	});

	test("drops whole lines that don't fit and says how many", () => {
		const lines = ["a".repeat(40), "b".repeat(40), "c".repeat(40)];
		const result = fitLines(lines, 100);
		expect(result).toBe(`${"a".repeat(40)}\n${"b".repeat(40)}\n…and 1 more`);
		expect(result.length).toBeLessThanOrEqual(100);
	});

	test("never goes over the limit, whatever is dropped", () => {
		const lines = Array.from(
			{ length: 50 },
			(_, i) => `line ${i} ${"x".repeat(i)}`,
		);
		for (const max of [30, 100, 500]) {
			expect(fitLines(lines, max).length).toBeLessThanOrEqual(max);
		}
	});

	test("truncates a single overlong line", () => {
		const result = fitLines(["x".repeat(300)], 100);
		expect(result).toHaveLength(100);
		expect(result.endsWith("…")).toBe(true);
	});

	test("an empty list is empty", () => {
		expect(fitLines([], 100)).toBe("");
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
