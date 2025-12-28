/**
 * Text normalization utilities for detecting bypass attempts
 * Handles l33tspeak, zalgo text, homoglyphs, and other evasion techniques
 */

// L33tspeak character mappings
const LEET_MAP: Record<string, string> = {
	"0": "o",
	"1": "i",
	"2": "z",
	"3": "e",
	"4": "a",
	"5": "s",
	"6": "g",
	"7": "t",
	"8": "b",
	"9": "g",
	"@": "a",
	$: "s",
	"!": "i",
	"|": "i",
	"+": "t",
	"(": "c",
	")": "d",
	"[": "c",
	"]": "d",
	"{": "c",
	"}": "d",
	"<": "c",
	">": "d",
	"*": "a",
	"#": "h",
	"%": "x",
	"^": "a",
	"&": "e",
};

// Common homoglyphs (look-alike characters)
const HOMOGLYPHS: Record<string, string> = {
	// Cyrillic
	"\u0430": "a", // а
	"\u0435": "e", // е
	"\u043E": "o", // о
	"\u0440": "p", // р
	"\u0441": "c", // с
	"\u0443": "y", // у
	"\u0445": "x", // х
	"\u0456": "i", // і
	"\u0458": "j", // ј
	"\u04CF": "i", // ӏ
	// Greek
	"\u03B1": "a", // α
	"\u03B5": "e", // ε
	"\u03B9": "i", // ι
	"\u03BF": "o", // ο
	"\u03C1": "p", // ρ
	"\u03C5": "u", // υ
	"\u03C9": "w", // ω
	// Special characters
	"\u00E0": "a",
	"\u00E1": "a",
	"\u00E2": "a",
	"\u00E3": "a",
	"\u00E4": "a",
	"\u00E5": "a",
	"\u00E8": "e",
	"\u00E9": "e",
	"\u00EA": "e",
	"\u00EB": "e",
	"\u00EC": "i",
	"\u00ED": "i",
	"\u00EE": "i",
	"\u00EF": "i",
	"\u00F2": "o",
	"\u00F3": "o",
	"\u00F4": "o",
	"\u00F5": "o",
	"\u00F6": "o",
	"\u00F9": "u",
	"\u00FA": "u",
	"\u00FB": "u",
	"\u00FC": "u",
	"\u00FD": "y",
	"\u00FF": "y",
	"\u00F1": "n",
	"\u00DF": "ss",
	"\u00E6": "ae",
	"\u0153": "oe",
	// Full-width characters
	"\uFF41": "a",
	"\uFF42": "b",
	"\uFF43": "c",
	"\uFF44": "d",
	"\uFF45": "e",
	"\uFF46": "f",
	"\uFF47": "g",
	"\uFF48": "h",
	"\uFF49": "i",
	"\uFF4A": "j",
	"\uFF4B": "k",
	"\uFF4C": "l",
	"\uFF4D": "m",
	"\uFF4E": "n",
	"\uFF4F": "o",
	"\uFF50": "p",
	"\uFF51": "q",
	"\uFF52": "r",
	"\uFF53": "s",
	"\uFF54": "t",
	"\uFF55": "u",
	"\uFF56": "v",
	"\uFF57": "w",
	"\uFF58": "x",
	"\uFF59": "y",
	"\uFF5A": "z",
};

/**
 * Remove zalgo/combining diacritical marks
 */
export function removeZalgo(text: string): string {
	// Remove combining diacritical marks (U+0300 to U+036F)
	// and other combining marks
	return text.normalize("NFD").replace(/[\u0300-\u036f\u0489]/g, "");
}

/**
 * Convert l33tspeak to normal text
 */
export function decodeLeetspeak(text: string): string {
	return text
		.split("")
		.map((char) => LEET_MAP[char] || char)
		.join("");
}

/**
 * Convert homoglyphs to ASCII equivalents
 */
export function normalizeHomoglyphs(text: string): string {
	return text
		.split("")
		.map((char) => HOMOGLYPHS[char] || char)
		.join("");
}

/**
 * Remove repeated characters (e.g., "helllllo" -> "helo")
 * Keeps at most 2 consecutive identical characters
 */
export function removeExcessiveRepeats(text: string): string {
	return text.replace(/(.)\1{2,}/g, "$1$1");
}

/**
 * Remove spaces and common separators used to bypass filters
 */
export function removeSeparators(text: string): string {
	return text.replace(/[\s._\-*~`'"]/g, "");
}

/**
 * Remove invisible characters
 */
export function removeInvisibleChars(text: string): string {
	// Remove zero-width characters and other invisible unicode
	return text.replace(
		/[\u200B-\u200D\uFEFF\u00AD\u2060\u180E\u2800\u3164]/g,
		"",
	);
}

/**
 * Fully normalize text for toxic content detection
 * Applies all normalization techniques
 */
export function normalizeText(text: string): string {
	let normalized = text.toLowerCase();
	normalized = removeInvisibleChars(normalized);
	normalized = removeZalgo(normalized);
	normalized = normalizeHomoglyphs(normalized);
	normalized = decodeLeetspeak(normalized);
	normalized = removeExcessiveRepeats(normalized);
	return normalized;
}

/**
 * Generate variations of a word for matching
 * Returns the original plus normalized versions
 */
export function generateWordVariations(word: string): string[] {
	const variations = new Set<string>();

	// Original lowercase
	variations.add(word.toLowerCase());

	// Fully normalized
	variations.add(normalizeText(word));

	// Without separators
	variations.add(removeSeparators(normalizeText(word)));

	return [...variations];
}

/**
 * Check if text contains a blocked word, accounting for bypass attempts
 */
export function containsBlockedWord(
	text: string,
	blockedWords: string[],
): { found: boolean; word?: string; matched?: string } {
	const normalizedText = normalizeText(text);
	const textWithoutSeparators = removeSeparators(normalizedText);

	for (const blockedWord of blockedWords) {
		const normalizedBlocked = normalizeText(blockedWord);

		// Check in normalized text
		if (normalizedText.includes(normalizedBlocked)) {
			return { found: true, word: blockedWord, matched: normalizedBlocked };
		}

		// Check in text without separators
		if (textWithoutSeparators.includes(normalizedBlocked)) {
			return { found: true, word: blockedWord, matched: normalizedBlocked };
		}

		// Word boundary check for short words to avoid false positives
		if (normalizedBlocked.length <= 3) {
			const wordBoundaryRegex = new RegExp(
				`\\b${escapeRegex(normalizedBlocked)}\\b`,
				"i",
			);
			if (
				wordBoundaryRegex.test(normalizedText) ||
				wordBoundaryRegex.test(textWithoutSeparators)
			) {
				return { found: true, word: blockedWord, matched: normalizedBlocked };
			}
		}
	}

	return { found: false };
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
