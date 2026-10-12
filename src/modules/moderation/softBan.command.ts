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

export const SoftBanCommand: Command<ApplicationCommandType.ChatInput> = {
	name: "softban",
	description: "Soft Ban a baaaaad boy",
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
			const user = interaction.options.getUser("user", true);
			const reason = interaction.options.getString("reason", false);
			const deleteMessages =
				interaction.options.getBoolean("delete_messages", false) ?? true;
			const dmSent = await dmModerationTarget(
				user,
				`You were kicked from ${interaction.guild.name} ${reason ? `with the reason: ${reason}` : ""}`, // saying "kicked" is intentional since they will be unbanned momentarily
			);

			await interaction.guild.bans.create(user, {
				reason: reason ?? undefined,
				deleteMessageSeconds: deleteMessages ? 604800 : undefined,
			});

			await logModerationAction(interaction.client, {
				kind: "SoftBan",
				dmSent,
				target: user,
				moderator: interaction.user,
				deleteMessages,
				reason,
			});

			const softBanMessage = await interaction.followUp({
				content: `Soft banned ${fakeMention(user)} (${user.id})`,
			});

			setTimeout(() => softBanMessage.delete().catch(() => null), 5000);
			if (!dmSent) {
				await interaction.followUp({
					flags: MessageFlags.Ephemeral,
					content: DM_FAILED_WARNING,
				});
			}
			setTimeout(() => interaction.guild?.bans.remove(user, "Softban"), 5000);
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
