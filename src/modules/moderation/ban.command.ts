import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { defineCommand, option } from "../../commands/index.js";
import { fakeMention } from "../../util/users.js";
import {
	DM_FAILED_WARNING,
	dmModerationTarget,
	logModerationAction,
} from "./logs.js";

export const BanCommand = defineCommand({
	name: "ban",
	description: "Ban a baaaaad boy",
	default_member_permissions: PermissionFlagsBits.BanMembers,
	options: {
		user: option.user({
			description: "The user to be banned",
			required: true,
		}),
		reason: option.string({
			description: "The reason why the user gets banned",
		}),
		delete_messages: option.boolean({
			description: "Should the users messages be deleted too? Defaults to True",
		}),
	},

	async handle(
		interaction,
		{ user, reason, delete_messages: deleteMessages = true },
	) {
		try {
			await interaction.deferReply();
			const dmSent = await dmModerationTarget(
				user,
				`You were banned from ${interaction.guild.name} ${reason ? `with the reason: ${reason}` : ""}`,
			);
			await interaction.guild.bans.create(user, {
				reason,
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
});
