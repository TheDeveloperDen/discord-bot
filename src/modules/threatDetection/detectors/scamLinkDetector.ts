import type { Message } from "discord.js";
import { logger } from "../../../logging.js";
import {
	ScamDomain,
	ScamDomainCategory,
} from "../../../store/models/ScamDomain.js";
import { ThreatAction, ThreatType } from "../../../store/models/ThreatLog.js";

export interface ScamDetectionResult {
	detected: boolean;
	threatType: ThreatType;
	severity: number;
	action: ThreatAction;
	details: {
		matchedUrls: string[];
		matchedDomains: string[];
		matchReason: "pattern" | "api" | "database";
	};
}

const URL_PATTERN = /https?:\/\/[^\s<>[\]{}|\\^`]+/gi;

const SCAM_PATTERNS = [
	/discord[\W_]*nitro/i,
	/free[\W_]*nitro/i,
	/steam[\W_]*community[\W_]*gift/i,
	/dls[\W_]*?cord/i,
	/disc0rd|d1scord|dlscord|disçord|dïscord/i,
	/discordgift/i,
	/discord-app\./i,
	/discordapp\.co[^m]/i,
	/steamcommunlty/i,
	/stearncommun/i,
	/stearncommunity/i,
];

const FAKE_DISCORD_DOMAINS = [
	/disc[o0]rd[^.]*\.(com|gg|gift|app|io|me|org)/i,
	/dlsc[o0]rd/i,
	/discord-nitro/i,
	/discordn[i1]tro/i,
	/discordgift\./i,
	/discord\.gift(?!\.)/i,
	/d[i1]sc[o0]rd[^.]*\./i,
];

const SHORTENER_DOMAINS = [
	"bit.ly",
	"tinyurl.com",
	"t.co",
	"goo.gl",
	"ow.ly",
	"is.gd",
	"buff.ly",
	"adf.ly",
	"shorte.st",
	"bc.vc",
	"j.mp",
	"soo.gd",
	"s.id",
	"cutt.ly",
	"rb.gy",
];

const SAFE_DOMAINS = [
	"discord.com",
	"discord.gg",
	"discordapp.com",
	"discord.gift",
	"discordstatus.com",
	"github.com",
	"github.io",
	"githubusercontent.com",
	"stackoverflow.com",
	"npmjs.com",
	"youtube.com",
	"youtu.be",
	"twitter.com",
	"x.com",
	"reddit.com",
	"wikipedia.org",
	"developer.mozilla.org",
	"docs.google.com",
	"google.com",
];

function extractDomain(url: string): string | null {
	try {
		const parsed = new URL(url);
		return parsed.hostname.toLowerCase();
	} catch {
		return null;
	}
}

function isDomainSafe(domain: string): boolean {
	return SAFE_DOMAINS.some(
		(safe) => domain === safe || domain.endsWith(`.${safe}`),
	);
}

function isShortenerDomain(domain: string): boolean {
	return SHORTENER_DOMAINS.some(
		(shortener) => domain === shortener || domain.endsWith(`.${shortener}`),
	);
}

function matchesScamPattern(url: string): boolean {
	return SCAM_PATTERNS.some((pattern) => pattern.test(url));
}

function matchesFakeDomain(domain: string): boolean {
	return FAKE_DISCORD_DOMAINS.some((pattern) => pattern.test(domain));
}

async function checkDatabaseBlocklist(
	domain: string,
): Promise<ScamDomain | null> {
	try {
		return await ScamDomain.findOne({
			where: { domain },
		});
	} catch {
		return null;
	}
}

async function checkPhishingApi(domain: string): Promise<boolean> {
	try {
		const response = await fetch(
			`https://phish.sinking.yachts/v2/check/${encodeURIComponent(domain)}`,
			{
				method: "GET",
				headers: {
					"X-Identity": "DevDenBot",
				},
				signal: AbortSignal.timeout(3000),
			},
		);
		if (!response.ok) {
			logger.debug(`Phishing API returned ${response.status} for ${domain}`);
			return false;
		}
		const body = await response.text();
		return body === "true";
	} catch (error) {
		logger.debug(`Phishing API check failed for ${domain}:`, error);
		return false;
	}
}

export async function detectScamLinks(
	message: Message,
	config: {
		useExternalApi: boolean;
		blockShorteners: boolean;
		safeDomains?: string[];
	},
): Promise<ScamDetectionResult> {
	const content = message.content;
	const urls = content.match(URL_PATTERN) || [];

	const matchedUrls: string[] = [];
	const matchedDomains: string[] = [];
	let matchReason: "pattern" | "api" | "database" = "pattern";
	let highestSeverity = 0;

	const additionalSafeDomains = config.safeDomains || [];

	for (const url of urls) {
		const domain = extractDomain(url);
		if (!domain) continue;

		if (isDomainSafe(domain) || additionalSafeDomains.includes(domain)) {
			continue;
		}

		if (matchesScamPattern(url)) {
			matchedUrls.push(url);
			matchedDomains.push(domain);
			highestSeverity = Math.max(highestSeverity, 0.9);
			matchReason = "pattern";
			continue;
		}

		if (matchesFakeDomain(domain)) {
			matchedUrls.push(url);
			matchedDomains.push(domain);
			highestSeverity = Math.max(highestSeverity, 0.95);
			matchReason = "pattern";
			continue;
		}

		const dbEntry = await checkDatabaseBlocklist(domain);
		if (dbEntry) {
			matchedUrls.push(url);
			matchedDomains.push(domain);
			highestSeverity = Math.max(
				highestSeverity,
				dbEntry.category === ScamDomainCategory.PHISHING ? 1 : 0.8,
			);
			matchReason = "database";
			continue;
		}

		if (config.blockShorteners && isShortenerDomain(domain)) {
			matchedUrls.push(url);
			matchedDomains.push(domain);
			highestSeverity = Math.max(highestSeverity, 0.5);
			matchReason = "pattern";
			continue;
		}

		if (config.useExternalApi) {
			const isPhishing = await checkPhishingApi(domain);
			if (isPhishing) {
				matchedUrls.push(url);
				matchedDomains.push(domain);
				highestSeverity = Math.max(highestSeverity, 1.0);
				matchReason = "api";
			}
		}
	}

	const detected = matchedUrls.length > 0;

	return {
		detected,
		threatType: ThreatType.SCAM_LINK,
		severity: highestSeverity,
		action: detected ? ThreatAction.DELETED : ThreatAction.FLAGGED,
		details: {
			matchedUrls,
			matchedDomains,
			matchReason,
		},
	};
}
