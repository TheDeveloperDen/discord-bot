/**
 * /revoke-achievement command
 *
 * Moderation command to revoke achievements from users.
 * Only staff members can use this command.
 */

import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
} from "discord.js";
import type { Command } from "djs-slash-helper";
import { wrapInTransaction } from "../../sentry.js";
import { fakeMention } from "../../util/users.js";
import {
	getAchievementById,
	getManualAchievements,
} from "./achievementDefinitions.js";
import { revokeAchievement } from "./achievementService.js";

// Build choices from manual achievements at startup
const achievementChoices = getManualAchievements().map((a) => ({
	name: `${a.emoji} ${a.name}`,
	value: a.id,
}));

export const RevokeAchievementCommand: Command<ApplicationCommandType.ChatInput> =
	{
		name: "revoke-achievement",
		type: ApplicationCommandType.ChatInput,
		description: "Revoke an achievement from a user (staff only)",
		default_permission: false,
		options: [
			{
				type: ApplicationCommandOptionType.User,
				name: "user",
				description: "The user to revoke the achievement from",
				required: true,
			},
			{
				type: ApplicationCommandOptionType.String,
				name: "achievement",
				description: "The achievement to revoke",
				required: true,
				choices: achievementChoices,
			},
		],

		handle: wrapInTransaction("revoke-achievement", async (_, interaction) => {
			if (
				!interaction.isChatInputCommand() ||
				!interaction.inGuild() ||
				interaction.guild === null
			)
				return;

			await interaction.deferReply({ ephemeral: true });

			const user = interaction.options.getUser("user", true);
			const achievementId = interaction.options.getString("achievement", true);

			// Validate achievement exists
			const achievement = getAchievementById(achievementId);
			if (!achievement) {
				await interaction.followUp({
					content: `Achievement \`${achievementId}\` not found.`,
					ephemeral: true,
				});
				return;
			}

			// Revoke the achievement
			const result = await revokeAchievement(BigInt(user.id), achievementId);

			if (result.error) {
				await interaction.followUp({
					content: `Failed to revoke achievement: ${result.error}`,
					ephemeral: true,
				});
				return;
			}

			if (result.didNotHave) {
				await interaction.followUp({
					content: `${fakeMention(user)} doesn't have the **${achievement.name}** achievement.`,
					ephemeral: true,
				});
				return;
			}

			await interaction.followUp({
				content: `Successfully revoked **${achievement.emoji} ${achievement.name}** from ${fakeMention(user)}.`,
				ephemeral: true,
			});
		}),
	};
