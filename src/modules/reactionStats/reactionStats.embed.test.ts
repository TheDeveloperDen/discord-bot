import { describe, expect, test } from "bun:test";
import {
	chunkEmbedFieldValues,
	EMBED_FIELD_VALUE_LIMIT,
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
