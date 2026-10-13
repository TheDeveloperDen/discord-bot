import { PermissionFlagsBits } from "discord.js";
import { defineCommand, option } from "../../commands/index.js";
import { logger } from "../../logging.js";
import { fakeMention } from "../../util/users.js";
import { logModerationAction } from "./logs.js";
import { getActiveTempBanModAction } from "./tempBan.js";

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

			const user = await interaction.client.users.fetch(userId);

			await interaction.guild.bans.remove(user.id, reason);

			const modAction = await getActiveTempBanModAction(BigInt(user.id));
			if (modAction) await modAction.destroy();

			await logModerationAction(interaction.client, {
				kind: "Unban",
				target: user,
				moderator: interaction.user,
				reason,
			});

			const unbanMessage = await interaction.followUp({
				content: `Unbanned ${fakeMention(user)} (${user.id})`,
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
