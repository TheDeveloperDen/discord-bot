import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	MessageFlags,
} from "discord.js";
import type { Command } from "djs-slash-helper";
import { logger } from "../../logging.js";
import { Warning } from "../../store/models/Warning.js";
import { fakeMention } from "../../util/users.js";
import { logModerationAction } from "./logs.js";

export const PardonCommand: Command<ApplicationCommandType.ChatInput> = {
	name: "pardon",
	description: "Pardon (remove) a warning from a user",
	type: ApplicationCommandType.ChatInput,
	default_permission: false,
	options: [
		{
			type: ApplicationCommandOptionType.Integer,
			name: "warning_id",
			description: "The ID of the warning to pardon",
			required: true,
		},
		{
			type: ApplicationCommandOptionType.String,
			name: "reason",
			description: "Reason for pardoning the warning",
			required: true,
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

			const warningId = interaction.options.getInteger("warning_id", true);
			const reason = interaction.options.getString("reason", true).trim();

			// Validate reason length
			if (reason.length === 0) {
				await interaction.editReply("Pardon reason cannot be empty.");
				return;
			}
			if (reason.length > 500) {
				await interaction.editReply(
					"Pardon reason must be under 500 characters.",
				);
				return;
			}

			// Use optimistic locking to prevent race conditions
			const [affectedRows] = await Warning.update(
				{
					pardoned: true,
					pardonedBy: BigInt(interaction.user.id),
					pardonReason: reason,
				},
				{
					where: {
						id: warningId,
						pardoned: false,
						expired: false,
					},
				},
			);

			if (affectedRows === 0) {
				// Check why it failed - either not found, already pardoned, or expired
				const warning = await Warning.findByPk(warningId);
				if (!warning) {
					await interaction.editReply({
						content: `Warning #${warningId} not found.`,
					});
				} else if (warning.pardoned) {
					await interaction.editReply({
						content: `Warning #${warningId} has already been pardoned.`,
					});
				} else if (warning.expired) {
					await interaction.editReply({
						content: `Warning #${warningId} has already expired.`,
					});
				} else {
					await interaction.editReply({
						content: `Could not pardon warning #${warningId}. Please try again.`,
					});
				}
				return;
			}

			// Fetch the warning for logging purposes
			const warning = await Warning.findByPk(warningId);
			if (!warning) {
				// Extremely unlikely: warning was deleted between update and fetch
				await interaction.editReply({
					content: `Warning #${warningId} was pardoned but could not be found for logging.`,
				});
				return;
			}

			const targetUser = await interaction.client.users
				.fetch(warning.userId.toString())
				.catch(() => null);

			if (targetUser) {
				await logModerationAction(interaction.client, {
					kind: "WarningPardoned",
					moderator: interaction.user,
					target: targetUser,
					warningId: warning.id,
					reason,
				});

				try {
					await targetUser.send({
						content:
							`Your warning #${warningId} in **${interaction.guild.name}** has been pardoned.\n` +
							`**Reason:** ${reason}`,
					});
				} catch {
					logger.info(
						`Could not DM pardon notice to user ${targetUser.id} - DMs may be disabled`,
					);
				}
			}

			await interaction.editReply({
				content:
					`Pardoned warning #${warningId}` +
					(targetUser ? ` for ${fakeMention(targetUser)}` : "") +
					`\n**Reason:** ${reason}`,
			});
		} catch (e) {
			logger.error("Failed to pardon warning:", e);
			if (interaction.replied || interaction.deferred) {
				await interaction.editReply("Something went wrong!");
			} else {
				await interaction.reply({
					content: "Something went wrong!",
					flags: MessageFlags.Ephemeral,
				});
			}
		}
	},
};
