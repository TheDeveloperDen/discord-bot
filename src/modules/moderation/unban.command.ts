import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
} from "discord.js";
import type { Command } from "djs-slash-helper";
import { logger } from "../../logging.js";
import { fakeMention } from "../../util/users.js";
import { logModerationAction } from "./logs.js";
import { getActiveTempBanModAction } from "./tempBan.js";

export const UnbanCommand: Command<ApplicationCommandType.ChatInput> = {
	name: "unban",
	description: "Unban a not so baaad boy",
	type: ApplicationCommandType.ChatInput,
	default_permission: false,
	options: [
		{
			type: ApplicationCommandOptionType.String,
			name: "user_id",
			description: "The user id to be unbanned",
			required: true,
		},
		{
			type: ApplicationCommandOptionType.String,
			name: "reason",
			description: "The reason why the user gets unbanned",
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
			await interaction.deferReply();
			const userId = interaction.options.getString("user_id", true);
			const reason = interaction.options.getString("reason", false);

			const user = await interaction.client.users.fetch(userId);

			await interaction.guild.bans.remove(user.id, reason ?? undefined);

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
};
