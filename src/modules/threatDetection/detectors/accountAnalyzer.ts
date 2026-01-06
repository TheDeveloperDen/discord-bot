import type { GuildMember } from "discord.js";
import { logger } from "../../../logging.js";
import { ThreatAction, ThreatType } from "../../../store/models/ThreatLog.js";

export interface AccountAnalysisResult {
	detected: boolean;
	threatType: ThreatType;
	severity: number;
	action: ThreatAction;
	details: {
		accountAgeDays: number;
		hasDefaultAvatar: boolean;
		suspiciousNameMatch: boolean;
		matchedPatterns: string[];
		reasons: string[];
	};
}

const DEFAULT_SUSPICIOUS_PATTERNS = [
	"^.{1,2}$",
	"^[a-z]{5,}\\d{4,}$",
	"nitro|free.*gift|steam.*gift",
	"discord.*mod|discord.*admin",
	"giveaway|airdrop|crypto",
];

// Pre-compiled regex cache for performance
const compiledPatternCache = new Map<string, RegExp>();
const MAX_PATTERN_LENGTH = 200;

// Detect patterns that could cause catastrophic backtracking (ReDoS)
const DANGEROUS_PATTERN_REGEX = /(\+|\*|\{[0-9]+,\})\s*\1|\(\?[^)]*\+/;

function isPatternSafe(pattern: string): boolean {
	// Reject overly long patterns
	if (pattern.length > MAX_PATTERN_LENGTH) {
		return false;
	}
	// Reject patterns with nested quantifiers (e.g., (a+)+ or (a*)*)
	if (DANGEROUS_PATTERN_REGEX.test(pattern)) {
		return false;
	}
	return true;
}

function getCompiledPattern(pattern: string): RegExp | null {
	const cached = compiledPatternCache.get(pattern);
	if (cached) return cached;

	// Check for potentially dangerous patterns (ReDoS prevention)
	if (!isPatternSafe(pattern)) {
		logger.warn(
			`Rejected potentially dangerous regex pattern: "${pattern.slice(0, 50)}..."`,
		);
		return null;
	}

	try {
		const compiled = new RegExp(pattern, "i");
		compiledPatternCache.set(pattern, compiled);
		return compiled;
	} catch (error) {
		logger.warn(`Invalid regex pattern "${pattern}":`, error);
		return null;
	}
}

function getAccountAgeDays(member: GuildMember): number {
	const createdAt = member.user.createdTimestamp;
	const now = Date.now();
	return (now - createdAt) / (1000 * 60 * 60 * 24);
}

function hasDefaultAvatar(member: GuildMember): boolean {
	return member.user.avatar === null;
}

function matchesSuspiciousPatterns(
	username: string,
	patterns: string[],
): { matches: boolean; matchedPatterns: string[] } {
	const matchedPatterns: string[] = [];

	for (const pattern of patterns) {
		const regex = getCompiledPattern(pattern);
		if (regex && regex.test(username)) {
			matchedPatterns.push(pattern);
		}
	}

	return {
		matches: matchedPatterns.length > 0,
		matchedPatterns,
	};
}

export function analyzeAccount(
	member: GuildMember,
	config: {
		minAgeDays: number;
		flagDefaultAvatar: boolean;
		flagSuspiciousNames: boolean;
		suspiciousNamePatterns?: string[];
		action: "flag" | "kick";
	},
): AccountAnalysisResult {
	const accountAgeDays = getAccountAgeDays(member);
	const defaultAvatar = hasDefaultAvatar(member);
	const patterns = config.suspiciousNamePatterns || DEFAULT_SUSPICIOUS_PATTERNS;
	const nameAnalysis = matchesSuspiciousPatterns(
		member.user.username,
		patterns,
	);

	const reasons: string[] = [];
	let severity = 0;

	if (accountAgeDays < config.minAgeDays) {
		reasons.push(`Account is only ${accountAgeDays.toFixed(1)} days old`);
		severity += 0.4;
	}

	if (config.flagDefaultAvatar && defaultAvatar) {
		reasons.push("Using default avatar");
		severity += 0.2;
	}

	if (config.flagSuspiciousNames && nameAnalysis.matches) {
		reasons.push(
			`Username matches suspicious patterns: ${nameAnalysis.matchedPatterns.join(", ")}`,
		);
		severity += 0.3;
	}

	severity = Math.min(severity, 1);
	const detected = reasons.length > 0;

	return {
		detected,
		threatType: ThreatType.SUSPICIOUS_ACCOUNT,
		severity,
		action: detected
			? config.action === "kick"
				? ThreatAction.KICKED
				: ThreatAction.FLAGGED
			: ThreatAction.FLAGGED,
		details: {
			accountAgeDays,
			hasDefaultAvatar: defaultAvatar,
			suspiciousNameMatch: nameAnalysis.matches,
			matchedPatterns: nameAnalysis.matchedPatterns,
			reasons,
		},
	};
}
