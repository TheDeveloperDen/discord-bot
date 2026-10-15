import { describe, expect, test } from "bun:test";
import { spoilerList } from "./wordlist.command.js";

describe("spoilerList", () => {
	test("spoilers every word when they fit", () => {
		expect(spoilerList(["foo", "bar"], 100)).toBe("||foo||, ||bar||");
	});

	test("keeps only whole words within the limit and counts the rest", () => {
		const words = Array.from({ length: 50 }, (_, i) => `word${i}`);
		const list = spoilerList(words, 100);

		expect(list.length).toBeLessThanOrEqual(100);
		expect(list).toMatch(/^(\|\|word\d+\|\|, )*\|\|word\d+\|\| and \d+ more$/);
		const shown = list.match(/\|\|word\d+\|\|/g)?.length ?? 0;
		expect(list).toEndWith(` and ${50 - shown} more`);
	});
});
