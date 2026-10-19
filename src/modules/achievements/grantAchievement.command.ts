import { PermissionFlagsBits } from "discord.js";
/**
 * /grant-achievement command
 *
 * Moderation command to manually grant achievements to users.
 * Only staff members can use this command.
 */

import { defineCommand, option } from "../../commands/index.js";
import { fakeMention } from "../../util/users.js";
import {
	getAchievementById,
	getActiveAchievements,
} from "./achievementDefinitions.js";
import { notifyMultipleAchievements } from "./achievementNotifier.js";
import { grantAchievement } from "./achievementService.js";

const achievementChoices = getActiveAchievements().map((a) => ({
	name: `${a.emoji} ${a.name}`,
	value: a.id,
}));

export const GrantAchievementCommand = defineCommand({
	name: "grant-achievement",
	description: "Grant an achievement to a user (staff only)",
	default_member_permissions: PermissionFlagsBits.ModerateMembers,
	options: {
		user: option.user({
			description: "The user to grant the achievement to",
			required: true,
		}),
		achievement: option.string({
			description: "The achievement to grant",
			required: true,
			autocomplete: () => achievementChoices,
		}),
		silent: option.boolean({
			description: "Don't send a notification to the user (default: false)",
		}),
	},

	async handle(
		interaction,
		{ user, achievement: achievementId, silent = false },
	) {
		await interaction.deferReply({ ephemeral: true });

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

		// Send notifications for every newly granted badge unless silent
		if (!silent) {
			const member = await interaction.guild.members.fetch(user.id);
			await notifyMultipleAchievements(
				interaction.client,
				member,
				result.awarded.map(({ definition }) => definition),
				interaction.channel ?? undefined,
			);
		}

		const awardedAchievements = result.awarded
			.map(({ definition }) => `**${definition.emoji} ${definition.name}**`)
			.join(", ");
		await interaction.followUp({
			content: `Successfully awarded ${awardedAchievements} to ${fakeMention(user)}${silent ? " (silently)" : ""}.`,
			ephemeral: true,
		});
	},
});
