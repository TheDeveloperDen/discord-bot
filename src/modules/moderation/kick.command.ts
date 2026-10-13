import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { defineCommand, option } from "../../commands/index.js";
import { fakeMention } from "../../util/users.js";
import {
	DM_FAILED_WARNING,
	dmModerationTarget,
	logModerationAction,
} from "./logs.js";

export const KickCommand = defineCommand({
	name: "kick",
	description: "Ban a baaaaad boy",
	default_member_permissions: PermissionFlagsBits.KickMembers,
	options: {
		user: option.member({
			description: "The user to be banned",
			required: true,
		}),
		reason: option.string({
			description: "The reason why the user gets banned",
		}),
	},

	async handle(interaction, { user: member, reason }) {
		try {
			await interaction.deferReply();

			const user = member.user;
			const dmSent = await dmModerationTarget(
				user,
				`You were kicked from ${interaction.guild.name} ${reason ? `for the reason: ${reason}` : ""}`,
			);

			await member.kick(reason);

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
});
