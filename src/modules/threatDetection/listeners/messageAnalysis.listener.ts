import * as Sentry from "@sentry/bun";
import type { GuildMember, Message } from "discord.js";
import { config } from "../../../Config.js";
import { logger } from "../../../logging.js";
import { ReputationEventType } from "../../../store/models/ReputationEvent.js";
import { ThreatAction, ThreatLog } from "../../../store/models/ThreatLog.js";
import { getMember } from "../../../util/member.js";
import { actualMention, isSpecialUser } from "../../../util/users.js";
import { deductReputation } from "../../moderation/reputation.service.js";
import type { EventListener } from "../../module.js";
import {
	detectMentionSpam,
	type MentionSpamResult,
} from "../detectors/mentionSpamDetector.js";
import {
	detectScamLinks,
	type ScamDetectionResult,
} from "../detectors/scamLinkDetector.js";
import {
	detectSpam,
	type SpamDetectionResult,
} from "../detectors/spamDetector.js";
import {
	detectToxicContent,
	type ToxicContentResult,
} from "../detectors/toxicContentDetector.js";
import { logThreatAction } from "../logs.js";

type DetectionResult =
	| ScamDetectionResult
	| SpamDetectionResult
	| MentionSpamResult
	| ToxicContentResult;

function isExemptRole(member: GuildMember): boolean {
	const exemptRoles = config.threatDetection?.exemptRoles || [];
	return exemptRoles.some((roleId) => member.roles.cache.has(roleId));
}

async function logThreatToDatabase(
	userId: bigint,
	result: DetectionResult,
	message: Message,
): Promise<void> {
	try {
		await ThreatLog.create({
			userId,
			threatType: result.threatType,
			severity: result.severity,
			actionTaken: result.action,
			messageContent: message.content.slice(0, 4000),
			messageId: BigInt(message.id),
			channelId: BigInt(message.channelId),
			metadata: result.details as Record<string, unknown>,
		});
	} catch (error) {
		logger.error("Failed to log threat to database:", error);
		Sentry.captureException(error);
	}
}

async function handleScamDetection(
	message: Message<true>,
	member: GuildMember,
	result: ScamDetectionResult,
	wasEdit: boolean,
): Promise<void> {
	try {
		try {
			await message.delete();
		} catch (deleteError) {
			logger.warn(`Failed to delete scam message ${message.id}:`, deleteError);
		}

		const warningMessage = await message.channel.send({
			content: `${actualMention(member)}, your message was removed because it contained a potentially malicious link. If you believe this was a mistake, please contact a moderator.`,
		});

		setTimeout(() => {
			warningMessage.delete().catch(() => {});
		}, 15000);

		await logThreatToDatabase(BigInt(member.id), result, message);

		await logThreatAction(message.client, {
			kind: "ScamLinkDetected",
			target: member.user,
			messageId: message.id,
			messageCreatedTimestamp: message.createdTimestamp,
			edited: wasEdit,
			matchedUrls: result.details.matchedUrls,
			matchedDomains: result.details.matchedDomains,
			matchReason: result.details.matchReason,
			severity: result.severity,
		});
	} catch (error) {
		logger.error("Failed to handle scam detection:", error);
		Sentry.captureException(error);
	}
}

async function handleSpamDetection(
	message: Message<true>,
	member: GuildMember,
	result: SpamDetectionResult,
): Promise<void> {
	try {
		try {
			await message.delete();
		} catch (deleteError) {
			logger.warn(`Failed to delete spam message ${message.id}:`, deleteError);
		}

		if (result.action === ThreatAction.MUTED) {
			const muteDuration = config.threatDetection?.spam?.muteDuration ?? 300000;
			try {
				await member.timeout(muteDuration, "Auto-mute: Spam detection");
			} catch (timeoutError) {
				logger.warn(
					`Failed to timeout member ${member.id} for spam:`,
					timeoutError,
				);
			}
		}

		// Deduct reputation for spam
		await deductReputation(
			BigInt(member.id),
			ReputationEventType.SPAM_DELETED,
			"Spam message deleted",
		);

		await logThreatToDatabase(BigInt(member.id), result, message);

		await logThreatAction(message.client, {
			kind: "SpamDetected",
			target: member.user,
			messageCount: result.details.messageCount,
			windowSeconds: result.details.windowSeconds,
			action: result.action,
		});
	} catch (error) {
		logger.error("Failed to handle spam detection:", error);
		Sentry.captureException(error);
	}
}

async function handleMentionSpamDetection(
	message: Message<true>,
	member: GuildMember,
	result: MentionSpamResult,
): Promise<void> {
	try {
		try {
			await message.delete();
		} catch (deleteError) {
			logger.warn(
				`Failed to delete mention spam message ${message.id}:`,
				deleteError,
			);
		}

		if (result.action === ThreatAction.MUTED) {
			const muteDuration =
				config.threatDetection?.mentionSpam?.windowSeconds ?? 60;
			try {
				await member.timeout(
					muteDuration * 1000 * 5,
					"Auto-mute: Mention spam",
				);
			} catch (timeoutError) {
				logger.warn(
					`Failed to timeout member ${member.id} for mention spam:`,
					timeoutError,
				);
			}
		}

		const warningMessage = await message.channel.send({
			content: `${actualMention(member)}, please avoid mass mentioning users.`,
		});

		setTimeout(() => {
			warningMessage.delete().catch(() => {});
		}, 10000);

		await logThreatToDatabase(BigInt(member.id), result, message);

		await logThreatAction(message.client, {
			kind: "SpamDetected",
			target: member.user,
			messageCount: result.details.mentionsInMessage,
			windowSeconds: result.details.windowSeconds,
			action: result.action,
		});
	} catch (error) {
		logger.error("Failed to handle mention spam detection:", error);
		Sentry.captureException(error);
	}
}

async function handleToxicContentDetection(
	message: Message<true>,
	member: GuildMember,
	result: ToxicContentResult,
): Promise<void> {
	try {
		if (result.action === ThreatAction.DELETED) {
			try {
				await message.delete();
			} catch (deleteError) {
				logger.warn(
					`Failed to delete toxic message ${message.id}:`,
					deleteError,
				);
			}

			const warningMessage = await message.channel.send({
				content: `${actualMention(member)}, your message was removed for containing inappropriate content.`,
			});

			setTimeout(() => {
				warningMessage.delete().catch(() => {});
			}, 10000);

			// Deduct reputation for toxic content
			await deductReputation(
				BigInt(member.id),
				ReputationEventType.TOXIC_CONTENT,
				`Toxic content detected: ${result.details.category || "unknown category"}`,
			);
		}

		await logThreatToDatabase(BigInt(member.id), result, message);

		await logThreatAction(message.client, {
			kind: "ToxicContentDetected",
			target: member.user,
			matchedWord: result.details.matchedWord,
			category: result.details.category,
			bypassAttempted: result.details.bypassAttempted,
			action: result.action,
		});
	} catch (error) {
		logger.error("Failed to handle toxic content detection:", error);
		Sentry.captureException(error);
	}
}

async function analyzeMessage(
	message: Message,
	wasEdit: boolean,
): Promise<void> {
	if (message.author.bot || !message.inGuild()) return;
	if (!config.threatDetection?.enabled) return;

	const member = await getMember(message);
	if (!member) return;
	if (isSpecialUser(member) || isExemptRole(member)) return;

	if (config.threatDetection.scamLinks?.enabled) {
		const scamResult = await detectScamLinks(message, {
			useExternalApi: config.threatDetection.scamLinks.useExternalApi ?? true,
			blockShorteners:
				config.threatDetection.scamLinks.blockShorteners ?? false,
			safeDomains: config.threatDetection.scamLinks.safeDomains,
		});

		if (scamResult.detected) {
			await handleScamDetection(message, member, scamResult, wasEdit);
			return;
		}
	}

	if (config.threatDetection.spam?.enabled && !wasEdit) {
		const spamResult = detectSpam(message, {
			maxMessagesPerWindow:
				config.threatDetection.spam.maxMessagesPerWindow ?? 5,
			windowSeconds: config.threatDetection.spam.windowSeconds ?? 10,
			duplicateThreshold: config.threatDetection.spam.duplicateThreshold ?? 0.8,
			action: config.threatDetection.spam.action ?? "delete",
		});

		if (spamResult.detected) {
			await handleSpamDetection(message, member, spamResult);
			return;
		}
	}

	if (config.threatDetection.mentionSpam?.enabled) {
		const mentionResult = detectMentionSpam(message, {
			maxMentionsPerMessage:
				config.threatDetection.mentionSpam.maxMentionsPerMessage ?? 5,
			maxMentionsPerWindow:
				config.threatDetection.mentionSpam.maxMentionsPerWindow ?? 10,
			windowSeconds: config.threatDetection.mentionSpam.windowSeconds ?? 60,
			action: config.threatDetection.mentionSpam.action ?? "delete",
		});

		if (mentionResult.detected) {
			await handleMentionSpamDetection(message, member, mentionResult);
			return;
		}
	}

	if (config.threatDetection.toxicContent?.enabled) {
		const toxicResult = await detectToxicContent(message, {
			detectBypasses:
				config.threatDetection.toxicContent.detectBypasses ?? true,
			action: config.threatDetection.toxicContent.action ?? "flag",
		});

		if (toxicResult.detected) {
			await handleToxicContentDetection(message, member, toxicResult);
			return;
		}
	}
}

export const MessageAnalysisListener: EventListener = {
	async messageCreate(_, message) {
		await analyzeMessage(message, false);
	},

	async messageUpdate(_, _oldMessage, message) {
		if (!message.partial) {
			await analyzeMessage(message, true);
		}
	},
};
