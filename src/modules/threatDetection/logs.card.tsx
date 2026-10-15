import type { Colors, User } from "discord.js";
import { Message, renderDiscordMessage } from "disjsx";
import {
	Card,
	type CardAuthor,
	type DetailItem,
	Details,
	memberAuthor,
} from "../../ui/index.js";
import type { ThreatLog } from "./logs.js";

type ThreatKindMapping<T> = {
	[K in ThreatLog["kind"]]: T;
};

const titles: ThreatKindMapping<string> = {
	ScamLinkDetected: "Scam Link Detected",
	RaidAlert: "Raid Alert",
	SpamDetected: "Spam Detected",
	ToxicContentDetected: "Toxic Content Detected",
	SuspiciousAccount: "Suspicious Account",
};

const accents: ThreatKindMapping<keyof typeof Colors> = {
	ScamLinkDetected: "Red",
	RaidAlert: "DarkRed",
	SpamDetected: "Orange",
	ToxicContentDetected: "DarkOrange",
	SuspiciousAccount: "Yellow",
};

const code = (values: string[]) => `\`${values.join("`, `")}\``;

/** A sentence about what happened, then its details */
const summaries: {
	[K in ThreatLog["kind"]]: (log: Extract<ThreatLog, { kind: K }>) => {
		summary: string;
		details: DetailItem[];
	};
} = {
	ScamLinkDetected: (log) => ({
		summary: `Their message at <t:${Math.round(log.messageCreatedTimestamp / 1000)}> ${log.edited ? "was edited to contain" : "contained"} a scam link.`,
		details: [
			["Matched URLs", code(log.matchedUrls)],
			["Matched domains", code(log.matchedDomains)],
			["Detection method", log.matchReason],
			["Severity", `${(log.severity * 100).toFixed(0)}%`],
		],
	}),
	RaidAlert: (log) => ({
		summary: `**${log.joinCount} users joined** in ${log.windowSeconds} seconds!`,
		details: [
			["New accounts (<7 days)", log.newAccountCount.toString()],
			["Raid mode activated", log.raidModeActivated ? "Yes" : "No"],
		],
	}),
	SpamDetected: (log) => ({
		summary: `Sent **${log.messageCount} messages** in ${log.windowSeconds} seconds.`,
		details: [["Action taken", log.action]],
	}),
	ToxicContentDetected: (log) => {
		const details: DetailItem[] = [];
		if (log.matchedWord)
			details.push(["Matched word", `||${log.matchedWord}||`]);
		if (log.category) details.push(["Category", log.category]);
		if (log.bypassAttempted) details.push(["Bypass attempted", "Yes"]);
		details.push(["Action taken", log.action]);
		return { summary: "Their message contained toxic content.", details };
	},
	SuspiciousAccount: (log) => ({
		summary: `Their account is **${log.accountAgeDays.toFixed(1)} days old**.`,
		details: [["Reasons", log.reasons.join(", ")]],
	}),
};

/**
 * A threat detection alert as a Components V2 card, with the user it's about (if any) beside a summary.
 * `target` is null when there's no user, or they couldn't be fetched.
 */
export function renderThreatLog(log: ThreatLog, target: User | null) {
	const summarise = summaries[log.kind] as (log: ThreatLog) => {
		summary: string;
		details: DetailItem[];
	};
	const { summary, details } = summarise(log);
	const author: CardAuthor | undefined =
		"target" in log
			? target
				? memberAuthor(target)
				: { name: log.target.id, userId: log.target.id }
			: undefined;

	return renderDiscordMessage(
		<Message isV2>
			<Card
				accent={accents[log.kind]}
				title={titles[log.kind]}
				author={author}
				description={summary}
				footer={"target" in log ? `User ID: ${log.target.id}` : undefined}
				timestamp={Date.now()}
			>
				<Details items={details} />
			</Card>
		</Message>,
	);
}
