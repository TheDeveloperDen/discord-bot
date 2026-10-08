import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	MessageFlags,
	PermissionFlagsBits,
} from "discord.js";
import type { Command } from "../../commands/index.js";
import { fakeMention } from "../../util/users.js";
import {
	DM_FAILED_WARNING,
	dmModerationTarget,
	logModerationAction,
} from "./logs.js";

export const KickCommand: Command<ApplicationCommandType.ChatInput> = {
	name: "kick",
	description: "Ban a baaaaad boy",
	type: ApplicationCommandType.ChatInput,
	default_member_permissions: PermissionFlagsBits.KickMembers,
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
			const dmSent = await dmModerationTarget(
				user,
				`You were kicked from ${interaction.guild.name} ${reason ? `for the reason: ${reason}` : ""}`,
			);

			await member.kick(reason ?? undefined);

			await logModerationAction(interaction.client, {
				kind: "Kick",
				dmSent,
				moderator: interaction.user,
				target: user,
				reason,
			});

			const kickMessage = await interaction.followUp({
				content: `Kicked ${fakeMention(user)} (${user.id})`,
			});

			setTimeout(() => kickMessage.delete().catch(() => null), 5000);
			if (!dmSent) {
				await interaction.followUp({
					flags: MessageFlags.Ephemeral,
					content: DM_FAILED_WARNING,
				});
			}
		} catch (e) {
			console.error("Failed to kick user: ", e);

			if (interaction.replied) {
				await interaction.editReply("Something went wrong!");
			} else {
				await interaction.followUp({
					flags: MessageFlags.Ephemeral,
					content: "Failed to kick member!",
				});
			}
		}
	},
};
