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

export const BanCommand: Command<ApplicationCommandType.ChatInput> = {
	name: "ban",
	description: "Ban a baaaaad boy",
	type: ApplicationCommandType.ChatInput,
	default_member_permissions: PermissionFlagsBits.BanMembers,
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
		{
			type: ApplicationCommandOptionType.Boolean,
			name: "delete_messages",
			description: "Should the users messages be deleted too? Defaults to True",
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
			const deleteMessages =
				interaction.options.getBoolean("delete_messages") ?? true;
			const user = interaction.options.getUser("user", true);
			const reason = interaction.options.getString("reason", false);
			const dmSent = await dmModerationTarget(
				user,
				`You were banned from ${interaction.guild.name} ${reason ? `with the reason: ${reason}` : ""}`,
			);
			await interaction.guild.bans.create(user, {
				reason: reason ?? undefined,
				deleteMessageSeconds: deleteMessages ? 604800 : undefined,
			});

			await logModerationAction(interaction.client, {
				kind: "Ban",
				dmSent,
				moderator: interaction.user,
				target: user,
				deleteMessages,
				reason,
			});

			const banMessage = await interaction.followUp({
				content: `Banned ${fakeMention(user)} (${user.id})`,
			});

			setTimeout(() => banMessage.delete().catch(() => null), 5000);
			if (!dmSent) {
				await interaction.followUp({
					flags: MessageFlags.Ephemeral,
					content: DM_FAILED_WARNING,
				});
			}
		} catch (e) {
			console.error("Failed to ban user: ", e);

			if (interaction.replied) {
				await interaction.editReply("Something went wrong!");
			} else {
				await interaction.followUp("Something went wrong!");
			}
		}
	},
};
