import * as Sentry from "@sentry/bun";
import type {
	Client,
	MessageCreateOptions,
	Snowflake,
	User,
	UserResolvable,
} from "discord.js";
import { config } from "../../Config.js";
import { logger } from "../../logging.js";
import { runObserved } from "../../observe.js";
import { upload } from "../pastify/pastify.js";
import { renderDeletedMessagesLog, renderModerationLog } from "./logs.card.js";

export interface CachedMessage {
	id: Snowflake;
	content: string;
	authorId: Snowflake;
	authorTag: string;
	channelId: Snowflake;
	createdTimestamp: number;
	attachmentUrls: string[];
}

export type ModerationLog =
	| BanLog
	| UnbanLog
	| TempBanLog
	| TempBanExpiredLog
	| SoftBanLog
	| KickLog
	| TimeoutLog
	| TimeoutRemovedLog
	| InviteDeletedLog
	| InviteSpamBanLog
	| WarningLog
	| WarningPardonedLog
	| ReputationGrantedLog;

/** actions whose target gets DMed to tell them about the action */
interface Notified {
	dmSent: boolean; // whether the target was successfully DMed about the action
}

interface BanLog extends Notified {
	kind: "Ban";
	moderator: User;
	target: UserResolvable;
	deleteMessages: boolean;
	reason?: string;
}

interface UnbanLog {
	kind: "Unban";
	moderator: User;
	target: UserResolvable;
	reason?: string;
}

interface SoftBanLog extends Notified {
	kind: "SoftBan";
	moderator: User;
	target: UserResolvable;
	deleteMessages: boolean;
	reason?: string;
}
interface TempBanLog extends Notified {
	kind: "TempBan";
	moderator: User;
	target: UserResolvable;
	deleteMessages: boolean;
	banDuration: number;
	reason?: string;
}

interface TempBanExpiredLog {
	kind: "TempBanEnded";
	target: UserResolvable;
}
interface KickLog extends Notified {
	kind: "Kick";
	moderator: User;
	target: UserResolvable;
	reason?: string;
}

interface TimeoutLog extends Notified {
	kind: "Timeout";
	moderator: User;
	target: UserResolvable;
	duration: number;
	reason: string;
}

interface TimeoutRemovedLog extends Notified {
	kind: "TimeoutRemoved";
	moderator: User;
	target: UserResolvable;
	reason?: string;
}

interface InviteDeletedLog {
	kind: "InviteDeleted";
	target: User;
	messageId: Snowflake;
	messageCreatedTimestamp: number;
	edited: boolean;
	matches: string[];
}

interface WarningLog extends Notified {
	kind: "Warning";
	moderator: User;
	target: UserResolvable;
	reason: string;
	severity: number;
	warningId: number;
	warningCount: number;
	expiresAt: Date | null;
}

interface WarningPardonedLog extends Notified {
	kind: "WarningPardoned";
	moderator: User;
	target: UserResolvable;
	warningId: number;
	reason: string;
}

interface ReputationGrantedLog extends Notified {
	kind: "ReputationGranted";
	moderator: User;
	target: UserResolvable;
	eventType: string;
	scoreChange: number;
	newScore: number;
	reason: string;
}

interface InviteSpamBanLog extends Notified {
	kind: "InviteSpamBan";
	target: User;
	violationCount: number;
	channelCount: number;
	violationWindowMs: number;
	triggerReason: "same_channel" | "cross_channel";
}

async function sendModerationLog(client: Client, action: ModerationLog) {
	const modLogChannel = await client.channels
		.fetch(config.channels.modLog)
		.catch(() => null);

	if (!modLogChannel) {
		logger.error(`Moderation log channel does not exist`);
		return;
	}

	if (!modLogChannel.isSendable()) {
		logger.error(`Moderation log channel is not sendable`);
		return;
	}

	const targetId = client.users.resolveId(action.target);
	if (!targetId) {
		logger.error(`Couldn't resolve the target of a ${action.kind} log`);
		return;
	}
	const target = await client.users.fetch(targetId).catch(() => null);
	await modLogChannel.send(renderModerationLog(action, targetId, target));
}

function formatMessageForPaste(message: CachedMessage): string {
	const timestamp = new Date(message.createdTimestamp).toISOString();
	const attachments =
		message.attachmentUrls.length > 0
			? `\nAttachments:\n${message.attachmentUrls.map((url) => `  - ${url}`).join("\n")}`
			: "";

	return `Author: ${message.authorTag} (${message.authorId})
Created: ${timestamp}
Message ID: ${message.id}

Content:
${message.content || "[No text content]"}${attachments}`;
}

export async function logDeletedMessage(
	client: Client,
	message: CachedMessage,
) {
	const modLogChannel = await client.channels.fetch(config.channels.modLog);
	if (!modLogChannel?.isSendable()) {
		logger.error("Moderation log channel not sendable");
		return;
	}

	const pasteContent = formatMessageForPaste(message);
	const pasteUrl = await upload({ content: pasteContent });

	await modLogChannel.send(
		renderDeletedMessagesLog({
			title: "Message Deleted",
			lines: [
				["Author", `<@${message.authorId}> (${message.authorTag})`],
				["Channel", `<#${message.channelId}>`],
				["Created", `<t:${Math.round(message.createdTimestamp / 1000)}:R>`],
				["Content", `[View on Paste](${pasteUrl})`],
			],
			footer: `Message ID: ${message.id}`,
		}),
	);
}

export async function logBulkDeletedMessages(
	client: Client,
	messages: CachedMessage[],
	channelId: Snowflake,
) {
	const modLogChannel = await client.channels.fetch(config.channels.modLog);
	if (!modLogChannel?.isSendable()) {
		logger.error("Moderation log channel not sendable");
		return;
	}

	// Sort by timestamp
	messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

	// Format all messages for paste
	const pasteContent = messages
		.map((m, i) => {
			const separator = i > 0 ? `\n${"─".repeat(50)}\n\n` : "";
			return separator + formatMessageForPaste(m);
		})
		.join("\n");

	const pasteUrl = await upload({ content: pasteContent });

	await modLogChannel.send(
		renderDeletedMessagesLog({
			title: "Bulk Messages Deleted",
			lines: [
				["Channel", `<#${channelId}>`],
				["Count", `${messages.length} messages`],
				["Messages", `[View on Paste](${pasteUrl})`],
			],
		}),
	);
}

/**
 * DMs the target of a moderation action with a set message
 * Returns false if they couldn't be DMed
 */
export async function dmModerationTarget(
	user: User,
	message: string | MessageCreateOptions,
): Promise<boolean> {
	try {
		await user.send(message);
		return true;
	} catch (error) {
		logger.warn(`Couldn't DM ${user.id} about a moderation action`, error);
		return false;
	}
}

export const DM_FAILED_WARNING =
	"⚠️ The user couldn't be DMed with a reason for the action";

/** Appended to a moderator's reply when the target couldn't be DMed */
export const dmWarning = (dmSent: boolean) =>
	dmSent ? "" : `\n${DM_FAILED_WARNING}`;

/**
 * Never throws: the action has already happened by the time it's logged,
 * so a logging failure must not be reported to the moderator as the action failing.
 */
export async function logModerationAction(
	client: Client,
	action: ModerationLog,
) {
	Sentry.addBreadcrumb({
		category: "moderation",
		message: `Logging ${action.kind}`,
		data: {
			target:
				typeof action.target === "object" ? action.target.id : action.target,
		},
	});
	await runObserved({ op: "event", name: `modLog.${action.kind}` }, () =>
		sendModerationLog(client, action),
	);
}
