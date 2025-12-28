import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	EmbedBuilder,
	MessageFlags,
} from "discord.js";
import type { Command } from "djs-slash-helper";
import { config } from "../../Config.js";
import { logger } from "../../logging.js";
import { getOrCreateUserById } from "../../store/models/DDUser.js";
import {
	getWarningCount,
	Warning,
	WarningSeverity,
} from "../../store/models/Warning.js";
import { parseTimespan } from "../../util/timespan.js";
import { fakeMention } from "../../util/users.js";
import { logModerationAction } from "./logs.js";
import { deductReputation, getWarningEventType } from "./reputation.service.js";

const SEVERITY_LABELS: Record<WarningSeverity, string> = {
	[WarningSeverity.MINOR]: "Minor",
	[WarningSeverity.MODERATE]: "Moderate",
	[WarningSeverity.SEVERE]: "Severe",
};

const DEFAULT_EXPIRY: Record<WarningSeverity, number | null> = {
	[WarningSeverity.MINOR]: 30 * 24 * 60 * 60 * 1000,
	[WarningSeverity.MODERATE]: 60 * 24 * 60 * 60 * 1000,
	[WarningSeverity.SEVERE]: null,
};

export const WarnCommand: Command<ApplicationCommandType.ChatInput> = {
	name: "warn",
	description: "Issue a formal warning to a user",
	type: ApplicationCommandType.ChatInput,
	default_permission: false,
	options: [
		{
			type: ApplicationCommandOptionType.User,
			name: "user",
			description: "The user to warn",
			required: true,
		},
		{
			type: ApplicationCommandOptionType.String,
			name: "reason",
			description: "Reason for the warning",
			required: true,
		},
		{
			type: ApplicationCommandOptionType.Integer,
			name: "severity",
			description: "Warning severity (default: Minor)",
			required: false,
			choices: [
				{ name: "Minor", value: WarningSeverity.MINOR },
				{ name: "Moderate", value: WarningSeverity.MODERATE },
				{ name: "Severe", value: WarningSeverity.SEVERE },
			],
		},
		{
			type: ApplicationCommandOptionType.String,
			name: "duration",
			description:
				"How long before warning expires (e.g., 30d, 90d). Leave empty for default based on severity",
			required: false,
		},
	],

	handle: async (interaction) => {
		if (
			!interaction.isChatInputCommand() ||
			!interaction.inGuild() ||
			interaction.guild === null
		)
			return;

		try {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });

			const user = interaction.options.getUser("user", true);
			const reason = interaction.options.getString("reason", true).trim();
			const severity =
				(interaction.options.getInteger("severity") as WarningSeverity) ||
				WarningSeverity.MINOR;
			const durationStr = interaction.options.getString("duration");

			// Validate reason
			if (reason.length === 0) {
				await interaction.editReply("Warning reason cannot be empty.");
				return;
			}
			if (reason.length > 500) {
				await interaction.editReply(
					"Warning reason must be under 500 characters.",
				);
				return;
			}

			let expiresAt: Date | null = null;
			const MAX_DURATION_MS = 365 * 24 * 60 * 60 * 1000; // 1 year
			if (durationStr) {
				const durationMs = parseTimespan(durationStr);
				if (durationMs <= 0) {
					await interaction.editReply(
						"Invalid duration format. Use formats like '30d', '2w', '24h'.",
					);
					return;
				}
				if (durationMs > MAX_DURATION_MS) {
					await interaction.editReply("Warning duration cannot exceed 1 year.");
					return;
				}
				expiresAt = new Date(Date.now() + durationMs);
			} else if (DEFAULT_EXPIRY[severity] !== null) {
				expiresAt = new Date(Date.now() + DEFAULT_EXPIRY[severity]);
			}

			// Ensure user exists in database before creating warning
			await getOrCreateUserById(BigInt(user.id));

			const warning = await Warning.create({
				userId: BigInt(user.id),
				moderatorId: BigInt(interaction.user.id),
				reason,
				severity,
				expiresAt,
			});

			// Deduct reputation based on warning severity
			const reputationEventType = getWarningEventType(severity);
			await deductReputation(
				BigInt(user.id),
				reputationEventType,
				reason,
				warning.id,
			);

			const warningCount = await getWarningCount(BigInt(user.id));

			try {
				const dmEmbed = new EmbedBuilder()
					.setTitle("You have received a warning")
					.setColor("Orange")
					.setDescription(
						`You have been warned in **${interaction.guild.name}**.\n\n` +
							`**Reason:** ${reason}\n` +
							`**Severity:** ${SEVERITY_LABELS[severity]}\n` +
							(expiresAt
								? `**Expires:** <t:${Math.floor(expiresAt.getTime() / 1000)}:R>\n`
								: "") +
							`\nThis is warning #${warningCount}. Please review the server rules to avoid further action.`,
					)
					.setTimestamp();

				await user.send({ embeds: [dmEmbed] });
			} catch {
				logger.info(
					`Could not DM warning to user ${user.id} - DMs may be disabled`,
				);
			}

			await logModerationAction(interaction.client, {
				kind: "Warning",
				moderator: interaction.user,
				target: user,
				reason,
				severity,
				warningId: warning.id,
				warningCount,
				expiresAt,
			});

			const thresholds = config.reputation?.warningThresholds;
			let escalationNote = "";
			if (thresholds) {
				if (warningCount >= thresholds.banAt) {
					escalationNote = `\n\n**Note:** User has ${warningCount} warnings and may be eligible for a ban.`;
				} else if (warningCount >= thresholds.muteAt) {
					escalationNote = `\n\n**Note:** User has ${warningCount} warnings and may be eligible for a mute.`;
				}
			}

			await interaction.editReply({
				content:
					`Warned ${fakeMention(user)} (Warning #${warningCount})\n` +
					`**Reason:** ${reason}\n` +
					`**Severity:** ${SEVERITY_LABELS[severity]}` +
					escalationNote,
			});
		} catch (e) {
			logger.error("Failed to warn user:", e);
			if (interaction.replied || interaction.deferred) {
				await interaction.editReply("Something went wrong!");
			} else {
				await interaction.reply({
					content: "Something went wrong!",
					ephemeral: true,
				});
			}
		}
	},
};
