import { describe, expect, test } from "bun:test";
import type { RegexDifficulty } from "./regexChallenge.js";
import {
	createRegexChallenge,
	isRegexChallengeMatch,
	MAX_REGEX_ANSWER_LENGTH,
} from "./regexChallenge.js";

function sequence(values: readonly number[]): () => number {
	let index = 0;
	return () => values[index++] ?? values.at(-1) ?? 0;
}

describe("createRegexChallenge", () => {
	test("constructs solvable challenges across every difficulty, family, and parameter boundary", () => {
		const selectors = [0, 0.26, 0.51, 0.76];
		const difficulties: readonly RegexDifficulty[] = ["easy", "medium", "hard"];

		for (const difficulty of difficulties) {
			const sources = new Set<string>();
			const challenges = selectors.flatMap((selector) =>
				[0, 0.999_999].map((parameter) =>
					createRegexChallenge(
						difficulty,
						sequence([selector, ...Array<number>(32).fill(parameter)]),
					),
				),
			);

			for (const challenge of challenges) {
				sources.add(challenge.source);
				expect(challenge.difficulty).toBe(difficulty);
				expect(challenge.example.length).toBeGreaterThan(0);
				expect(challenge.example.length).toBeLessThanOrEqual(
					MAX_REGEX_ANSWER_LENGTH,
				);
				expect(isRegexChallengeMatch(challenge, challenge.example)).toBe(true);
				expect(
					new RegExp(challenge.source, challenge.flags).exec(
						challenge.example,
					)?.[0],
				).toBe(challenge.example);
			}

			expect(sources.size).toBeGreaterThanOrEqual(4);
		}
	});

	test("uses fixed-length two-word answers for easy challenges", () => {
		const challenge = createRegexChallenge(
			"easy",
			sequence([0, ...Array<number>(32).fill(0)]),
		);

		expect(isRegexChallengeMatch(challenge, "Zed Fox")).toBe(true);
		expect(isRegexChallengeMatch(challenge, "Zed Fo")).toBe(false);
		expect(isRegexChallengeMatch(challenge, "Zed  Fox")).toBe(false);
	});

	test("accepts an optional medium suffix both with and without it", () => {
		const challenge = createRegexChallenge(
			"medium",
			sequence([0, ...Array<number>(32).fill(0)]),
		);

		expect(isRegexChallengeMatch(challenge, "AB")).toBe(true);
		expect(isRegexChallengeMatch(challenge, "AB-12")).toBe(true);
	});

	test("enforces randomized grouped-repeat bounds in medium challenges", () => {
		const challenge = createRegexChallenge(
			"medium",
			sequence([0.26, ...Array<number>(32).fill(0)]),
		);

		expect(isRegexChallengeMatch(challenge, "red_aa0bb0")).toBe(true);
		expect(isRegexChallengeMatch(challenge, "red_aa0bb0cc0")).toBe(true);
		expect(isRegexChallengeMatch(challenge, "red_aa0")).toBe(false);
		expect(isRegexChallengeMatch(challenge, "red_aa0bb0cc0dd0")).toBe(false);
	});

	test("requires both an uppercase vowel ending and repeated named code", () => {
		const challenge = createRegexChallenge(
			"hard",
			sequence([0.51, ...Array<number>(32).fill(0)]),
		);

		expect(isRegexChallengeMatch(challenge, "ID-AE-AE")).toBe(true);
		expect(isRegexChallengeMatch(challenge, "ID-AE-AI")).toBe(false);
		expect(isRegexChallengeMatch(challenge, "ID-AB-AB")).toBe(false);
	});

	test("accepts Unicode letters and number characters in hard challenges", () => {
		const challenge = createRegexChallenge(
			"hard",
			sequence([0.76, ...Array<number>(32).fill(0)]),
		);

		expect(isRegexChallengeMatch(challenge, "Åéß-٢٣")).toBe(true);
	});
});

describe("isRegexChallengeMatch", () => {
	test("accepts valid answers other than the generated example", () => {
		const challenge = { source: "^[A-Z]{2}-\\d{2}$", flags: "" };

		expect(isRegexChallengeMatch(challenge, "XY-73")).toBe(true);
	});

	test("requires the complete raw input instead of a matching substring or line", () => {
		const twoWords = { source: "^[A-Za-z]{3} [A-Za-z]{4}$", flags: "" };
		const multiline = { source: "^[A-Z]{2}$", flags: "m" };

		expect(isRegexChallengeMatch(twoWords, "Ada Love")).toBe(true);
		expect(isRegexChallengeMatch(twoWords, "Ada Love\n")).toBe(false);
		expect(isRegexChallengeMatch(twoWords, "\nAda Love")).toBe(false);
		expect(isRegexChallengeMatch(twoWords, "Ada  Love")).toBe(false);
		expect(isRegexChallengeMatch(twoWords, " Ada Love")).toBe(false);
		expect(isRegexChallengeMatch(twoWords, "Ada Love ")).toBe(false);
		expect(isRegexChallengeMatch(twoWords, "Ada Love now")).toBe(false);
		expect(isRegexChallengeMatch(multiline, "AA\nBB")).toBe(false);
		expect(isRegexChallengeMatch(multiline, "\nAA")).toBe(false);
	});

	test("rejects answers beyond the safe input limit", () => {
		expect(
			isRegexChallengeMatch(
				{ source: "^a+$", flags: "" },
				"a".repeat(MAX_REGEX_ANSWER_LENGTH + 1),
			),
		).toBe(false);
	});
});
