import * as Sentry from "@sentry/bun";
import type { GuildMember } from "discord.js";
import { config } from "../../../Config.js";
import { logger } from "../../../logging.js";
import { ThreatLog } from "../../../store/models/ThreatLog.js";
import type { EventListener } from "../../module.js";
import {
	type AccountAnalysisResult,
	analyzeAccount,
} from "../detectors/accountAnalyzer.js";
import {
	detectRaid,
	isRaidModeActive,
	type RaidDetectionResult,
} from "../detectors/raidDetector.js";
import { logThreatAction } from "../logs.js";

async function logThreatToDatabase(
	userId: bigint,
	result: RaidDetectionResult | AccountAnalysisResult,
): Promise<void> {
	try {
		await ThreatLog.create({
			userId,
			threatType: result.threatType,
			severity: result.severity,
			actionTaken: result.action,
			messageContent: null,
			messageId: null,
			channelId: null,
			metadata: result.details as Record<string, unknown>,
		});
	} catch (error) {
		logger.error("Failed to log threat to database:", error);
		Sentry.captureException(error);
	}
}

async function handleRaidDetection(
	member: GuildMember,
	result: RaidDetectionResult,
): Promise<void> {
	try {
		await logThreatToDatabase(BigInt(member.id), result);

		await logThreatAction(member.client, {
			kind: "RaidAlert",
			joinCount: result.details.joinCount,
			windowSeconds: result.details.windowSeconds,
			newAccountCount: result.details.newAccountCount,
			raidModeActivated: result.details.raidModeActive,
		});

		if (
			config.threatDetection?.raid?.action === "kick_new" &&
			result.details.raidModeActive
		) {
			const accountAgeDays =
				(Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
			if (
				accountAgeDays < (config.threatDetection.raid.newAccountThreshold || 7)
			) {
				try {
					await member.kick("Auto-kicked: Raid protection - new account");
				} catch (kickError) {
					logger.warn(
						`Failed to kick member ${member.id} during raid protection:`,
						kickError,
					);
				}
			}
		}
	} catch (error) {
		logger.error("Failed to handle raid detection:", error);
		Sentry.captureException(error);
	}
}

async function handleSuspiciousAccount(
	member: GuildMember,
	result: AccountAnalysisResult,
): Promise<void> {
	try {
		await logThreatToDatabase(BigInt(member.id), result);

		await logThreatAction(member.client, {
			kind: "SuspiciousAccount",
			target: member.user,
			accountAgeDays: result.details.accountAgeDays,
			reasons: result.details.reasons,
		});

		if (config.threatDetection?.suspiciousAccounts?.action === "kick") {
			try {
				await member.kick(
					`Auto-kicked: Suspicious account - ${result.details.reasons.join(", ")}`,
				);
			} catch (kickError) {
				logger.warn(
					`Failed to kick suspicious account ${member.id}:`,
					kickError,
				);
			}
		}
	} catch (error) {
		logger.error("Failed to handle suspicious account:", error);
		Sentry.captureException(error);
	}
}

export const MemberJoinListener: EventListener = {
	async guildMemberAdd(_, member) {
		if (!config.threatDetection?.enabled) return;

		if (config.threatDetection.raid?.enabled) {
			const raidResult = detectRaid(member, {
				maxJoinsPerWindow: config.threatDetection.raid.maxJoinsPerWindow ?? 10,
				windowSeconds: config.threatDetection.raid.windowSeconds ?? 60,
				newAccountThreshold:
					config.threatDetection.raid.newAccountThreshold ?? 7,
				action: config.threatDetection.raid.action ?? "alert",
			});

			if (raidResult.detected) {
				await handleRaidDetection(member, raidResult);
			}
		}

		if (config.threatDetection.suspiciousAccounts?.enabled) {
			const raidMode = isRaidModeActive(member.guild.id);
			const shouldAnalyze =
				raidMode ||
				config.threatDetection.suspiciousAccounts.minAgeDays > 0 ||
				config.threatDetection.suspiciousAccounts.flagDefaultAvatar ||
				config.threatDetection.suspiciousAccounts.flagSuspiciousNames;

			if (shouldAnalyze) {
				const accountResult = analyzeAccount(member, {
					minAgeDays: config.threatDetection.suspiciousAccounts.minAgeDays ?? 7,
					flagDefaultAvatar:
						config.threatDetection.suspiciousAccounts.flagDefaultAvatar ??
						false,
					flagSuspiciousNames:
						config.threatDetection.suspiciousAccounts.flagSuspiciousNames ??
						false,
					suspiciousNamePatterns:
						config.threatDetection.suspiciousAccounts.suspiciousNamePatterns,
					action: config.threatDetection.suspiciousAccounts.action ?? "flag",
				});

				if (accountResult.detected) {
					await handleSuspiciousAccount(member, accountResult);
				}
			}
		}
	},
};
