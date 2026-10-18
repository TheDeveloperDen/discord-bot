export type RegexDifficulty = "easy" | "medium" | "hard";

export interface RegexChallenge {
	difficulty: RegexDifficulty;
	source: string;
	flags: string;
	example: string;
	hint: string;
	explanation: string;
}

export const MAX_REGEX_ANSWER_LENGTH = 128;

type Random = () => number;
type ChallengeTemplate = (random: Random) => Omit<RegexChallenge, "difficulty">;

const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";

function randomInteger(
	random: Random,
	minimum: number,
	maximum: number,
): number {
	return minimum + Math.floor(random() * (maximum - minimum + 1));
}

function randomCharacters(
	random: Random,
	alphabet: string,
	length: number,
): string {
	let value = "";
	for (let index = 0; index < length; index += 1) {
		value += alphabet[randomInteger(random, 0, alphabet.length - 1)];
	}
	return value;
}

function randomUniqueCharacters(
	random: Random,
	alphabet: string,
	length: number,
): string {
	const available = alphabet.split("");
	let value = "";
	for (let index = 0; index < length; index += 1) {
		const characterIndex = randomInteger(random, 0, available.length - 1);
		const character = available.splice(characterIndex, 1)[0];
		if (character === undefined) {
			throw new Error("Not enough unique characters");
		}
		value += character;
	}
	return value;
}

function pick<T>(random: Random, values: readonly T[]): T {
	const value = values[randomInteger(random, 0, values.length - 1)];
	if (value === undefined) {
		throw new Error("Cannot select from an empty list");
	}
	return value;
}

const easyTemplates: readonly ChallengeTemplate[] = [
	(random) => {
		const firstLength = randomInteger(random, 3, 7);
		const secondLength = randomInteger(random, 3, 8);
		const example = `${randomCharacters(random, UPPERCASE + LOWERCASE, firstLength)} ${randomCharacters(random, UPPERCASE + LOWERCASE, secondLength)}`;
		return {
			source: `^[A-Za-z]{${firstLength}} [A-Za-z]{${secondLength}}$`,
			flags: "",
			example,
			hint: "Enter two alphabetic words with one ordinary space between them.",
			explanation: `The first word has exactly ${firstLength} letters, followed by one space and a second word of exactly ${secondLength} letters.`,
		};
	},
	(random) => {
		const letters = randomInteger(random, 2, 5);
		const digits = randomInteger(random, 2, 4);
		const example = `${randomCharacters(random, UPPERCASE, letters)}-${randomCharacters(random, DIGITS, digits)}`;
		return {
			source: `^[A-Z]{${letters}}-\\d{${digits}}$`,
			flags: "",
			example,
			hint: "Use uppercase letters, then a hyphen, then digits.",
			explanation: `This expression requires exactly ${letters} uppercase letters, a hyphen, and exactly ${digits} digits.`,
		};
	},
	(random) => {
		const letters = randomInteger(random, 3, 6);
		const digits = randomInteger(random, 2, 5);
		const example = `${randomCharacters(random, LOWERCASE, letters)}_${randomCharacters(random, DIGITS, digits)}`;
		return {
			source: `^[a-z]{${letters}}_\\d{${digits}}$`,
			flags: "",
			example,
			hint: "Use lowercase letters, one underscore, and then digits.",
			explanation: `The lowercase prefix is ${letters} letters long and the numeric suffix is ${digits} digits long; the underscore is required.`,
		};
	},
	(random) => {
		const animal = pick(random, ["cat", "dog", "fox"]);
		const digits = randomInteger(random, 1, 3);
		const example = `${animal}${randomCharacters(random, DIGITS, digits)}`;
		return {
			source: `^(?:cat|dog|fox)\\d{${digits}}$`,
			flags: "",
			example,
			hint: "Choose one animal name from a short list and add digits immediately after it.",
			explanation: `The non-capturing group accepts cat, dog, or fox, followed by exactly ${digits} digit${digits === 1 ? "" : "s"}.`,
		};
	},
];

const mediumTemplates: readonly ChallengeTemplate[] = [
	(random) => {
		const letters = randomInteger(random, 2, 4);
		const digits = randomInteger(random, 2, 3);
		const includeSuffix = randomInteger(random, 0, 1) === 1;
		const example = `${randomCharacters(random, UPPERCASE, letters)}${includeSuffix ? `-${randomCharacters(random, DIGITS, digits)}` : ""}`;
		return {
			source: `^[A-Z]{2,4}(?:-\\d{${digits}})?$`,
			flags: "",
			example,
			hint: "Start with a short uppercase code; a hyphen-and-digits suffix may be present.",
			explanation: `The code has 2 to 4 uppercase letters. Its optional suffix, when used, is a hyphen followed by exactly ${digits} digits.`,
		};
	},
	(random) => {
		const colour = pick(random, ["red", "blue", "green"]);
		const minimumRepetitions = randomInteger(random, 2, 3);
		const maximumRepetitions = randomInteger(random, minimumRepetitions + 1, 4);
		const repetitions = randomInteger(
			random,
			minimumRepetitions,
			maximumRepetitions,
		);
		let pairs = "";
		for (let index = 0; index < repetitions; index += 1) {
			pairs += `${randomCharacters(random, LOWERCASE, 2)}${randomCharacters(random, DIGITS, 1)}`;
		}
		return {
			source: `^(?:red|blue|green)_(?:[a-z]{2}\\d){${minimumRepetitions},${maximumRepetitions}}$`,
			flags: "",
			example: `${colour}_${pairs}`,
			hint: "Choose a colour word, add an underscore, then repeat a two-letter-and-digit unit.",
			explanation: `The colour is red, blue, or green. After the underscore, a lowercase pair plus one digit repeats from ${minimumRepetitions} to ${maximumRepetitions} times.`,
		};
	},
	(random) => {
		const prefixLength = randomInteger(random, 3, 6);
		const suffixLength = randomInteger(random, 2, 4);
		const example = `${randomCharacters(random, UPPERCASE + LOWERCASE, prefixLength)}:${randomCharacters(random, LOWERCASE, suffixLength)}`;
		return {
			source: `^[^\\s\\d_]{${prefixLength}}:[a-z]{${suffixLength}}$`,
			flags: "",
			example,
			hint: "Before the colon, avoid whitespace, digits, and underscores; after it, use lowercase letters.",
			explanation: `The negated class permits exactly ${prefixLength} characters that are not whitespace, digits, or underscores. The suffix is ${suffixLength} lowercase letters.`,
		};
	},
	(random) => {
		const letters = randomInteger(random, 3, 6);
		const digits = randomInteger(random, 2, 4);
		const example = `${randomCharacters(random, UPPERCASE + LOWERCASE, letters)}${randomCharacters(random, DIGITS, digits)}`;
		return {
			source: `^[a-z]{${letters}}\\d{${digits}}$`,
			flags: "i",
			example,
			hint: "Use letters followed by digits; letter case does not matter for this puzzle.",
			explanation: `With the i flag, the ${letters} letters may be uppercase or lowercase. They are followed by exactly ${digits} digits.`,
		};
	},
];

const hardTemplates: readonly ChallengeTemplate[] = [
	(random) => {
		const length = randomInteger(random, 6, 10);
		const uppercase = randomCharacters(random, UPPERCASE, 1);
		const digit = randomCharacters(random, DIGITS, 1);
		const middle = randomCharacters(random, LOWERCASE + DIGITS, length - 2);
		const example = `${uppercase}${middle}${digit}`;
		return {
			source: `^(?=[A-Za-z0-9]{${length}}$)(?=.*[A-Z])(?=.*\\d)[A-Za-z0-9]+$`,
			flags: "",
			example,
			hint: "Make an alphanumeric code of the required total length that includes both an uppercase letter and a digit.",
			explanation: `The leading lookahead fixes the total length at ${length}; the next two lookaheads require at least one uppercase letter and one digit.`,
		};
	},
	(random) => {
		const letters = randomInteger(random, 3, 6);
		const digits = randomInteger(random, 2, 4);
		const example = `${randomUniqueCharacters(random, LOWERCASE, letters)}${randomUniqueCharacters(random, DIGITS, digits)}`;
		return {
			source: `^(?!.*(.)\\1)[a-z]{${letters}}\\d{${digits}}$`,
			flags: "",
			example,
			hint: "Use lowercase letters followed by digits, without repeating any character consecutively.",
			explanation: `The negative lookahead uses backreference \\1 to forbid an adjacent repeated character. The rest requires ${letters} lowercase letters and ${digits} digits.`,
		};
	},
	(random) => {
		const letters = randomInteger(random, 2, 5);
		const code = `${randomCharacters(random, UPPERCASE, letters - 1)}${randomCharacters(random, "AEIOU", 1)}`;
		return {
			source: `^ID-(?<code>[A-Z]{${letters}})(?<=[AEIOU])-\\k<code>$`,
			flags: "",
			example: `ID-${code}-${code}`,
			hint: "Start with ID-, use an uppercase code ending in a vowel, then repeat that exact code after a hyphen.",
			explanation: `The named group captures ${letters} uppercase letters. The fixed-width lookbehind requires its final character to be A, E, I, O, or U, and the named backreference repeats the same code.`,
		};
	},
	(random) => {
		const uppercase = randomInteger(random, 1, 3);
		const lowercase = randomInteger(random, 2, 5);
		const digits = randomInteger(random, 2, 4);
		const example = `${randomCharacters(random, UPPERCASE, uppercase)}${randomCharacters(random, LOWERCASE, lowercase)}-${randomCharacters(random, DIGITS, digits)}`;
		return {
			source: `^\\p{Lu}{${uppercase}}\\p{Ll}{${lowercase}}-\\p{N}{${digits}}$`,
			flags: "u",
			example,
			hint: "Use Unicode uppercase letters, then Unicode lowercase letters, a hyphen, and Unicode number characters.",
			explanation: `With the u flag, Unicode properties require ${uppercase} uppercase letter${uppercase === 1 ? "" : "s"}, ${lowercase} lowercase letters, and ${digits} number characters after the hyphen.`,
		};
	},
];

const templatesByDifficulty: Record<
	RegexDifficulty,
	readonly ChallengeTemplate[]
> = {
	easy: easyTemplates,
	medium: mediumTemplates,
	hard: hardTemplates,
};

export function createRegexChallenge(
	difficulty: RegexDifficulty,
	random: Random = Math.random,
): RegexChallenge {
	const template = pick(random, templatesByDifficulty[difficulty]);
	return { difficulty, ...template(random) };
}

export function isRegexChallengeMatch(
	challenge: Pick<RegexChallenge, "source" | "flags">,
	input: string,
): boolean {
	if (input.length > MAX_REGEX_ANSWER_LENGTH) {
		return false;
	}

	const match = new RegExp(challenge.source, challenge.flags).exec(input);
	return (
		match !== null && match.index === 0 && match[0].length === input.length
	);
}
