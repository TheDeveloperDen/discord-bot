import * as Sentry from "@sentry/bun";
import { Op } from "@sequelize/core";
import type { Client, Guild } from "discord.js";
import * as schedule from "node-schedule";
import { config } from "../../Config.js";
import { logger } from "../../logging.js";
import { getWarningCount, Warning } from "../../store/models/Warning.js";
import type { EventListener } from "../module.js";

async function expireWarnings(): Promise<number> {
	const now = new Date();

	const [expiredCount] = await Warning.update(
		{ expired: true },
		{
			where: {
				expired: false,
				pardoned: false,
				expiresAt: {
					[Op.not]: null,
					[Op.lte]: now,
				},
			},
		},
	);

	if (expiredCount > 0) {
		logger.info(`Expired ${expiredCount} warnings`);
	}

	return expiredCount;
}

async function checkEscalations(client: Client, guild: Guild): Promise<void> {
	const thresholds = config.reputation?.warningThresholds;
	if (!thresholds) return;

	const recentWarnings = await Warning.findAll({
		where: {
			expired: false,
			pardoned: false,
			createdAt: {
				[Op.gte]: new Date(Date.now() - 60 * 60 * 1000),
			},
		},
		order: [["createdAt", "DESC"]],
	});

	const userWarningCounts = new Map<string, number>();

	for (const warning of recentWarnings) {
		const count = await getWarningCount(warning.userId);
		userWarningCounts.set(warning.userId.toString(), count);
	}

	for (const [userId, count] of userWarningCounts) {
		try {
			const member = await guild.members.fetch(userId).catch(() => null);
			if (!member) continue;

			if (count >= thresholds.banAt) {
				logger.info(
					`User ${userId} has ${count} warnings, eligible for ban (threshold: ${thresholds.banAt})`,
				);
			} else if (count >= thresholds.muteAt) {
				const isTimedOut = member.isCommunicationDisabled();
				if (!isTimedOut) {
					logger.info(
						`User ${userId} has ${count} warnings, eligible for auto-mute (threshold: ${thresholds.muteAt})`,
					);
				}
			}
		} catch (error) {
			logger.error(`Failed to check escalation for user ${userId}:`, error);
			Sentry.captureException(error);
		}
	}
}

export const WarningSchedulerListener: EventListener = {
	async clientReady(client) {
		logger.info("Starting warning expiration scheduler");

		schedule.scheduleJob("0 * * * *", async () => {
			try {
				await expireWarnings();

				const guild = await client.guilds
					.fetch(config.guildId)
					.catch(() => null);
				if (guild) {
					await checkEscalations(client, guild);
				}
			} catch (error) {
				logger.error("Warning scheduler job failed:", error);
				Sentry.captureException(error);
			}
		});

		await expireWarnings();
	},
};
