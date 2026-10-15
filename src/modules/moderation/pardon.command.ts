import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { defineCommand, option } from "../../commands/index.js";
import { logger } from "../../logging.js";
import { pardonWarning } from "./undo.js";

export const PardonCommand = defineCommand({
	name: "pardon",
	description: "Pardon (remove) a warning from a user",
	default_member_permissions: PermissionFlagsBits.ModerateMembers,
	options: {
		warning_id: option.integer({
			description: "The ID of the warning to pardon",
			required: true,
		}),
		reason: option.string({
			description: "Reason for pardoning the warning",
			required: true,
		}),
	},

	async handle(interaction, { warning_id: warningId, reason }) {
		try {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			const result = await pardonWarning(
				interaction.guild,
				interaction.user,
				warningId,
				reason,
			);
			await interaction.editReply({ content: result.message });
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
});
