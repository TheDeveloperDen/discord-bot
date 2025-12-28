import type { Message } from "discord.js";
import {
	type BlockedWord,
	type BlockedWordCategory,
	getAllBlockedWords,
} from "../../../store/models/BlockedWord.js";
import { ThreatAction, ThreatType } from "../../../store/models/ThreatLog.js";
import {
	containsBlockedWord,
	normalizeText,
} from "../utils/textNormalization.js";

export interface ToxicContentResult {
	detected: boolean;
	threatType: ThreatType;
	severity: number;
	action: ThreatAction;
	details: {
		matchedWord: string | null;
		category: BlockedWordCategory | null;
		normalizedMatch: string | null;
		bypassAttempted: boolean;
	};
}

// Cache blocked words to avoid repeated database queries
let cachedBlockedWords: BlockedWord[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 60_000; // 1 minute cache

async function getBlockedWordsFromCache(): Promise<BlockedWord[]> {
	const now = Date.now();
	if (cachedBlockedWords === null || now > cacheExpiry) {
		cachedBlockedWords = await getAllBlockedWords();
		cacheExpiry = now + CACHE_TTL;
	}
	return cachedBlockedWords;
}

/**
 * Invalidate the blocked words cache (call after adding/removing words)
 */
export function invalidateBlockedWordsCache(): void {
	cachedBlockedWords = null;
	cacheExpiry = 0;
}

// Severity weights by category
const CATEGORY_SEVERITY: Record<BlockedWordCategory, number> = {
	SLUR: 1,
	HARASSMENT: 0.8,
	NSFW: 0.6,
	SPAM: 0.4,
	OTHER: 0.5,
};

export async function detectToxicContent(
	message: Message,
	config: {
		detectBypasses: boolean;
		action: "flag" | "delete";
	},
): Promise<ToxicContentResult> {
	const blockedWords = await getBlockedWordsFromCache();

	if (blockedWords.length === 0) {
		return {
			detected: false,
			threatType: ThreatType.TOXIC_CONTENT,
			severity: 0,
			action: ThreatAction.FLAGGED,
			details: {
				matchedWord: null,
				category: null,
				normalizedMatch: null,
				bypassAttempted: false,
			},
		};
	}

	const content = message.content;
	const wordList = blockedWords.map((w) => w.word);

	// Check for bypass attempts by comparing original vs normalized text
	const originalLower = content.toLowerCase();
	const normalized = normalizeText(content);
	const bypassAttempted = originalLower !== normalized;

	const result = containsBlockedWord(content, wordList);

	if (result.found && result.word) {
		const matchedBlockedWord = blockedWords.find(
			(w) => w.word === result.word?.toLowerCase(),
		);
		const category = matchedBlockedWord?.category ?? null;
		const severity =
			category !== null
				? CATEGORY_SEVERITY[category as BlockedWordCategory]
				: 0.5;

		// If bypasses aren't being detected and one was used, don't flag
		if (bypassAttempted && !config.detectBypasses) {
			// Only detect if the original text contains the word
			if (!originalLower.includes(result.word.toLowerCase())) {
				return {
					detected: false,
					threatType: ThreatType.TOXIC_CONTENT,
					severity: 0,
					action: ThreatAction.FLAGGED,
					details: {
						matchedWord: null,
						category: null,
						normalizedMatch: null,
						bypassAttempted,
					},
				};
			}
		}

		return {
			detected: true,
			threatType: ThreatType.TOXIC_CONTENT,
			severity,
			action:
				config.action === "delete"
					? ThreatAction.DELETED
					: ThreatAction.FLAGGED,
			details: {
				matchedWord: result.word,
				category,
				normalizedMatch: result.matched || null,
				bypassAttempted,
			},
		};
	}

	return {
		detected: false,
		threatType: ThreatType.TOXIC_CONTENT,
		severity: 0,
		action: ThreatAction.FLAGGED,
		details: {
			matchedWord: null,
			category: null,
			normalizedMatch: null,
			bypassAttempted,
		},
	};
}

/**
 * Test a string against the blocked wordlist without taking action
 * Useful for the /wordlist test command
 */
export async function testForToxicContent(
	text: string,
	detectBypasses = true,
): Promise<{
	detected: boolean;
	matchedWord: string | null;
	category: BlockedWordCategory | null;
	normalizedMatch: string | null;
	bypassAttempted: boolean;
}> {
	const blockedWords = await getBlockedWordsFromCache();

	if (blockedWords.length === 0) {
		return {
			detected: false,
			matchedWord: null,
			category: null,
			normalizedMatch: null,
			bypassAttempted: false,
		};
	}

	const wordList = blockedWords.map((w) => w.word);
	const originalLower = text.toLowerCase();
	const normalized = normalizeText(text);
	const bypassAttempted = originalLower !== normalized;

	const result = containsBlockedWord(text, wordList);

	if (result.found && result.word) {
		const matchedBlockedWord = blockedWords.find(
			(w) => w.word === result.word?.toLowerCase(),
		);

		if (bypassAttempted && !detectBypasses) {
			if (!originalLower.includes(result.word.toLowerCase())) {
				return {
					detected: false,
					matchedWord: null,
					category: null,
					normalizedMatch: null,
					bypassAttempted,
				};
			}
		}

		return {
			detected: true,
			matchedWord: result.word,
			category: matchedBlockedWord?.category || null,
			normalizedMatch: result.matched || null,
			bypassAttempted,
		};
	}

	return {
		detected: false,
		matchedWord: null,
		category: null,
		normalizedMatch: null,
		bypassAttempted,
	};
}
