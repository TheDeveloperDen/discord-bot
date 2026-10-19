import { PermissionFlagsBits } from "discord.js";
/**
 * /revoke-achievement command
 *
 * Moderation command to revoke achievements from users.
 * Only staff members can use this command.
 */

import { defineCommand, option } from "../../commands/index.js";
import { fakeMention } from "../../util/users.js";
import {
	getAchievementById,
	getActiveAchievements,
} from "./achievementDefinitions.js";
import { revokeAchievement } from "./achievementService.js";

const achievementChoices = getActiveAchievements().map((a) => ({
	name: `${a.emoji} ${a.name}`,
	value: a.id,
}));

export const RevokeAchievementCommand = defineCommand({
	name: "revoke-achievement",
	description: "Revoke an achievement from a user (staff only)",
	default_member_permissions: PermissionFlagsBits.ModerateMembers,
	options: {
		user: option.user({
			description: "The user to revoke the achievement from",
			required: true,
		}),
		achievement: option.string({
			description: "The achievement to revoke",
			required: true,
			autocomplete: () => achievementChoices,
		}),
	},

	async handle(interaction, { user, achievement: achievementId }) {
		await interaction.deferReply({ ephemeral: true });

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
	},
});
