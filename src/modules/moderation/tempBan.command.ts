import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { defineCommand, option } from "../../commands/index.js";
import { logger } from "../../logging.js";
import { parseTimespan, prettyPrintDuration } from "../../util/timespan.js";
import { fakeMention } from "../../util/users.js";
import {
	DM_FAILED_WARNING,
	dmModerationTarget,
	logModerationAction,
} from "./logs.js";
import { createTempBanModAction } from "./tempBan.js";

export const TempBanCommand = defineCommand({
	name: "tempban",
	description: "Temp Ban a baaaaad boy",
	default_member_permissions: PermissionFlagsBits.BanMembers,
	options: {
		user: option.user({
			description: "The user to be banned",
			required: true,
		}),
		ban_duration_days: option.string({
			description: "The duration of the ban",
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
		{
			user,
			ban_duration_days: banDurationDays,
			reason,
			delete_messages: deleteMessages = true,
		},
	) {
		try {
			await interaction.deferReply();
			const banDurationMillis = parseTimespan(banDurationDays);
			const dmSent = await dmModerationTarget(
				user,
				`You were temp-banned from ${interaction.guild.name} ${reason ? `for the reason: ${reason}` : ""} for ${prettyPrintDuration(banDurationMillis)}`,
			);

			await interaction.guild.bans.create(user, {
				reason: reason,
				deleteMessageSeconds: deleteMessages ? 604800 : undefined,
			});
			const unbanTimestamp = Math.floor(
				(Date.now() + banDurationMillis) / 1000,
			);
			await createTempBanModAction(
				interaction.user,
				user,
				new Date(unbanTimestamp),
				reason ?? null,
			);

			await logModerationAction(interaction.client, {
				kind: "TempBan",
				dmSent,
				moderator: interaction.user,
				target: user,
				deleteMessages,
				banDuration: banDurationMillis,
				reason,
			});

			const tempBanMessage = await interaction.followUp({
				content: `Temp banned ${fakeMention(user)} (${user.id})`,
			});

			setTimeout(() => tempBanMessage.delete().catch(() => null), 5000);
			if (!dmSent) {
				await interaction.followUp({
					flags: MessageFlags.Ephemeral,
					content: DM_FAILED_WARNING,
				});
			}
		} catch (e) {
			logger.error("Failed to ban user: ", e);

			if (interaction.replied) {
				await interaction.editReply("Something went wrong!");
			} else {
				await interaction.followUp("Something went wrong!");
			}
		}
	},
});
