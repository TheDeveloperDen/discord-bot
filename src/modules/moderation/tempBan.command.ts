import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
} from "discord.js";
import type { Command } from "djs-slash-helper";
import { logger } from "../../logging.js";
import { parseTimespan, prettyPrintDuration } from "../../util/timespan.js";
import { fakeMention } from "../../util/users.js";
import { logModerationAction } from "./logs.js";
import { createTempBanModAction } from "./tempBan.js";

export const TempBanCommand: Command<ApplicationCommandType.ChatInput> = {
	name: "tempban",
	description: "Temp Ban a baaaaad boy",
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
			name: "ban_duration_days",
			description: "The duration of the ban",
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
			const banDurationMillis = parseTimespan(
				interaction.options.getString("ban_duration_days", true),
			);
			const deleteMessages =
				interaction.options.getBoolean("delete_messages", false) ?? true;
			try {
				await user.send({
					content: `You got temp-banned from ${interaction.guild.name} ${reason ? `with the reason: ${reason}` : ""} for ${prettyPrintDuration(banDurationMillis)}`,
				});
			} catch {
				/* empty */
			}

			await interaction.guild.bans.create(user, {
				reason: reason ?? undefined,
				deleteMessageSeconds: deleteMessages ? 604800 : undefined,
			});
			const unbanTimestamp = Math.floor(
				(Date.now() + banDurationMillis) / 1000,
			);
			await createTempBanModAction(
				interaction.user,
				user,
				new Date(unbanTimestamp),
				reason,
			);

			await logModerationAction(interaction.client, {
				kind: "TempBan",
				moderator: interaction.user,
				target: user,
				deleteMessages,
				banDuration: banDurationMillis,
				reason: reason ?? undefined,
			});

			const tempBanMessage = await interaction.followUp({
				content: `Temp banned ${fakeMention(user)} (${user.id})`,
			});

			setTimeout(() => tempBanMessage.delete().catch(() => null), 5000);
		} catch (e) {
			logger.error("Failed to ban user: ", e);

			if (interaction.replied) {
				await interaction.editReply("Something went wrong!");
			} else {
				await interaction.followUp("Something went wrong!");
			}
		}
	},
};
