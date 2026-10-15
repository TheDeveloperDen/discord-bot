import { PermissionFlagsBits } from "discord.js";
import { defineCommand, option } from "../../commands/index.js";
import { logger } from "../../logging.js";
import { unbanUser } from "./undo.js";

export const UnbanCommand = defineCommand({
	name: "unban",
	description: "Unban a not so baaad boy",
	default_member_permissions: PermissionFlagsBits.BanMembers,
	options: {
		user_id: option.string({
			description: "The user id to be unbanned",
			required: true,
		}),
		reason: option.string({
			description: "The reason why the user gets unbanned",
		}),
	},

	async handle(interaction, { user_id: userId, reason }) {
		try {
			await interaction.deferReply();

			const result = await unbanUser(
				interaction.guild,
				interaction.user,
				userId,
				reason,
			);
			const unbanMessage = await interaction.followUp({
				content: result.message,
			});

			setTimeout(() => unbanMessage.delete().catch(() => null), 5000);
		} catch (e) {
			logger.error("Failed to unban user: ", e);

			if (interaction.replied) {
				await interaction.editReply(
					"Something went wrong! ( User ID incorrect? )",
				);
			} else {
				await interaction.followUp(
					"Something went wrong! ( User ID incorrect? )",
				);
			}
		}
	},
});
