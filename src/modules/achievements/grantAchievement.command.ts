/**
 * /grant-achievement command
 *
 * Moderation command to manually grant achievements to users.
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
import { notifyAchievementUnlocked } from "./achievementNotifier.js";
import { grantAchievement } from "./achievementService.js";

// Build choices from manual achievements at startup
const achievementChoices = getManualAchievements().map((a) => ({
	name: `${a.emoji} ${a.name}`,
	value: a.id,
}));

export const GrantAchievementCommand: Command<ApplicationCommandType.ChatInput> =
	{
		name: "grant-achievement",
		type: ApplicationCommandType.ChatInput,
		description: "Grant an achievement to a user (staff only)",
		default_permission: false,
		options: [
			{
				type: ApplicationCommandOptionType.User,
				name: "user",
				description: "The user to grant the achievement to",
				required: true,
			},
			{
				type: ApplicationCommandOptionType.String,
				name: "achievement",
				description: "The achievement to grant",
				required: true,
				choices: achievementChoices,
			},
			{
				type: ApplicationCommandOptionType.Boolean,
				name: "silent",
				description: "Don't send a notification to the user (default: false)",
				required: false,
			},
		],

		handle: wrapInTransaction("grant-achievement", async (_, interaction) => {
			if (
				!interaction.isChatInputCommand() ||
				!interaction.inGuild() ||
				interaction.guild === null
			)
				return;

			await interaction.deferReply({ ephemeral: true });

			const user = interaction.options.getUser("user", true);
			const achievementId = interaction.options.getString("achievement", true);
			const silent = interaction.options.getBoolean("silent") ?? false;

			// Validate achievement exists and is manual
			const achievement = getAchievementById(achievementId);
			if (!achievement) {
				await interaction.followUp({
					content: `Achievement \`${achievementId}\` not found.`,
					ephemeral: true,
				});
				return;
			}

			if (achievement.trigger.type !== "manual") {
				await interaction.followUp({
					content: `Achievement **${achievement.name}** cannot be manually granted. Only special achievements can be granted manually.`,
					ephemeral: true,
				});
				return;
			}

			// Grant the achievement
			const result = await grantAchievement(BigInt(user.id), achievementId);

			if (result.error) {
				await interaction.followUp({
					content: `Failed to grant achievement: ${result.error}`,
					ephemeral: true,
				});
				return;
			}

			if (result.alreadyHad) {
				await interaction.followUp({
					content: `${fakeMention(user)} already has the **${achievement.name}** achievement.`,
					ephemeral: true,
				});
				return;
			}

			// Send notification unless silent
			if (!silent) {
				const member = await interaction.guild.members.fetch(user.id);
				await notifyAchievementUnlocked(
					interaction.client,
					member,
					achievement,
					interaction.channel ?? undefined,
				);
			}

			await interaction.followUp({
				content: `Successfully granted **${achievement.emoji} ${achievement.name}** to ${fakeMention(user)}${silent ? " (silently)" : ""}.`,
				ephemeral: true,
			});
		}),
	};
