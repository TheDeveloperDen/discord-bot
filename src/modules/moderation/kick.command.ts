import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
} from "discord.js";
import type { Command } from "djs-slash-helper";
import { logger } from "../../logging.js";
import { fakeMention } from "../../util/users.js";
import { logModerationAction } from "./logs.js";

export const KickCommand: Command<ApplicationCommandType.ChatInput> = {
	name: "kick",
	description: "Ban a baaaaad boy",
	type: ApplicationCommandType.ChatInput,
	default_permission: false,
	options: [
		{
			type: ApplicationCommandOptionType.User,
			name: "user",
			description: "The user to be banned",
			required: true,
		},
		{
			type: ApplicationCommandOptionType.String,
			name: "reason",
			description: "The reason why the user gets banned",
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
			const user = interaction.options.getUser("user", true);
			const reason = interaction.options.getString("reason", false);

			const member = await interaction.guild.members.fetch(user.id);
			try {
				await user.send({
					content: `You were kicked from ${interaction.guild.name} ${reason ? `with the reason: ${reason}` : ""}`,
				});
			} catch {
				logger.warn(`Unable to DM user %s about being kicked`, user.id);
			}

			await member.kick(reason ?? undefined);

			await logModerationAction(interaction.client, {
				kind: "Kick",
				moderator: interaction.user,
				target: user,
				reason,
			});

			const kickMessage = await interaction.followUp({
				content: `Kicked ${fakeMention(user)} (${user.id})`,
			});

			setTimeout(() => kickMessage.delete().catch(() => null), 5000);
		} catch (e) {
			console.error("Failed to kick user: ", e);

			if (interaction.replied) {
				await interaction.editReply("Something went wrong!");
			} else {
				await interaction.followUp({
					flags: "Ephemeral",
					content: "Failed to kick member!",
				});
			}
		}
	},
};
