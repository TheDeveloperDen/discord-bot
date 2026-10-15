import type { Colors, User } from "discord.js";
import { ActionRow, Message, renderDiscordMessage, TextDisplay } from "disjsx";
import { Card, type CardAuthor, memberAuthor } from "../../ui/index.js";
import { excerpt } from "../../util/strings.js";
import { prettyPrintDuration } from "../../util/timespan.js";
import type { ModerationLog } from "./logs.js";
import { type UndoAction, UndoButtonView } from "./logs.undo.js";

type ModerationKindMapping<T> = {
	[K in ModerationLog["kind"]]: T;
};

const titles: ModerationKindMapping<string> = {
	Ban: "Member Banned",
	Unban: "Member Unbanned",
	SoftBan: "Member Softbanned",
	InviteDeleted: "Discord Invite Removed",
	InviteSpamBan: "Member Auto-Banned (Invite Spam)",
	TempBan: "Member Tempbanned",
	Kick: "Member Kicked",
	Timeout: "Member Timed Out",
	TimeoutRemoved: "Timeout Removed",
	TempBanEnded: "Tempban Expired",
	Warning: "Member Warned",
	WarningPardoned: "Warning Pardoned",
	ReputationGranted: "Reputation Granted",
};

type ColorName = keyof typeof Colors;

const accents: ModerationKindMapping<ColorName> = {
	Ban: "Red",
	TempBan: "Orange",
	SoftBan: "DarkOrange",
	Kick: "Yellow",
	Timeout: "LightGrey",
	TimeoutRemoved: "Green",
	Unban: "Green",
	TempBanEnded: "DarkGreen",
	InviteDeleted: "Blurple",
	InviteSpamBan: "DarkRed",
	// overridden by severity below
	Warning: "Gold",
	WarningPardoned: "Aqua",
	ReputationGranted: "Green",
};

export const SEVERITY_LABELS: Record<number, string> = {
	1: "Minor",
	2: "Moderate",
	3: "Severe",
};

const severityAccents: Record<number, ColorName> = {
	1: "Gold",
	2: "Orange",
	3: "Red",
};

type Details = {
	[K in ModerationLog["kind"]]?: (
		log: Extract<ModerationLog, { kind: K }>,
	) => [label: string, value: string][];
};

const timestamp = (ms: number, style = "f") =>
	`<t:${Math.floor(ms / 1000)}:${style}>`;

/** What each kind shows beyond the reason, moderator and DM status */
const details: Details = {
	InviteDeleted: (log) => [
		[
			"Message",
			`${log.messageId}, sent ${timestamp(log.messageCreatedTimestamp)}${log.edited ? " (edited to include the invite)" : ""}`,
		],
		["Invites", log.matches.join(", ")],
	],
	TempBan: (log) => [["Ban duration", prettyPrintDuration(log.banDuration)]],
	Timeout: (log) => [["Duration", prettyPrintDuration(log.duration)]],
	Warning: (log) => [
		["Severity", SEVERITY_LABELS[log.severity] ?? "Unknown"],
		["Warning ID", `#${log.warningId}`],
		["Active warnings", log.warningCount.toString()],
		[
			"Expires",
			log.expiresAt ? timestamp(log.expiresAt.getTime(), "R") : "Never",
		],
	],
	WarningPardoned: (log) => [["Warning ID", `#${log.warningId}`]],
	ReputationGranted: (log) => [
		["Type", log.eventType],
		["Score change", `+${log.scoreChange}`],
		["New score", `${log.newScore >= 0 ? "+" : ""}${log.newScore}`],
	],
	InviteSpamBan: (log) => [
		["Violations", `${log.violationCount} in ${log.violationWindowMs / 1000}s`],
		["Channels", log.channelCount.toString()],
		[
			"Trigger",
			log.triggerReason === "same_channel"
				? "4+ violations in the same channel"
				: "Violations across 3+ channels",
		],
	],
};

/** The undo button a kind gets, and what it undoes */
const undoFor = (
	log: ModerationLog,
	targetId: string,
): { action: UndoAction; targetId: string } | undefined => {
	switch (log.kind) {
		case "Ban":
		case "TempBan":
		case "InviteSpamBan":
			return { action: "unban", targetId };
		case "Timeout":
			return { action: "untimeout", targetId };
		case "Warning":
			return { action: "pardon", targetId: log.warningId.toString() };
		default:
			return undefined;
	}
};

const detailText = (lines: [string, string][]) =>
	lines.map(([label, value]) => `**${label}:** ${value}`).join("\n");

/** A deleted message (or a bulk delete), whose content was uploaded to the paste service */
export function renderDeletedMessagesLog({
	title,
	lines,
	footer,
}: {
	title: string;
	lines: [string, string][];
	footer?: string;
}) {
	return renderDiscordMessage(
		<Message isV2>
			<Card
				accent="Grey"
				title={title}
				description={detailText(lines)}
				footer={footer}
				timestamp={Date.now()}
			/>
		</Message>,
	);
}

const MAX_REASON_LENGTH = 1500;

/**
 * A moderation action's mod log message, as a Components V2 card:
 * the target beside the reason, the action's details, and a button to undo it where that makes sense.
 * `target` is null when the user couldn't be fetched (e.g. a deleted account).
 */
export function renderModerationLog(
	log: ModerationLog,
	targetId: string,
	target: User | null,
) {
	const author: CardAuthor = target
		? memberAuthor(target)
		: { name: targetId, userId: targetId };
	const reason = "reason" in log && log.reason ? log.reason : undefined;

	const lines: [string, string][] = [];
	if ("moderator" in log) lines.push(["Moderator", `<@${log.moderator.id}>`]);
	if ("deleteMessages" in log && log.deleteMessages) {
		lines.push(["Deleted messages", "Yes"]);
	}
	const kindDetails = details[log.kind] as
		| ((log: ModerationLog) => [string, string][])
		| undefined;
	lines.push(...(kindDetails?.(log) ?? []));
	if ("dmSent" in log) lines.push(["DM sent", log.dmSent ? "✅" : "❌"]);

	const undo = undoFor(log, targetId);
	return renderDiscordMessage(
		<Message isV2>
			<Card
				accent={
					log.kind === "Warning"
						? (severityAccents[log.severity] ?? accents.Warning)
						: accents[log.kind]
				}
				title={titles[log.kind]}
				author={author}
				description={
					reason && excerpt(reason, { maxLength: MAX_REASON_LENGTH })
				}
				footer={`User ID: ${targetId}`}
				timestamp={Date.now()}
			>
				{lines.length > 0 && <TextDisplay>{detailText(lines)}</TextDisplay>}
			</Card>
			{undo && (
				<ActionRow>
					<UndoButtonView action={undo.action} targetId={undo.targetId} />
				</ActionRow>
			)}
		</Message>,
	);
}
