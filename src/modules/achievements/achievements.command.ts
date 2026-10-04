/**
 * /achievements command
 *
 * Displays a user's achievements grouped by category.
 */

import { defineCommand, option } from "../../commands/index.js";
import { createStandardEmbed } from "../../util/embeds.js";
import { fakeMention } from "../../util/users.js";
import {
	type AchievementCategory,
	CATEGORY_INFO,
} from "./achievementDefinitions.js";
import {
	getAchievementProgress,
	getAchievementsWithStatus,
} from "./achievementService.js";

const CATEGORY_ORDER: AchievementCategory[] = [
	"bump",
	"daily",
	"level",
	"starboard",
	"reaction",
	"introduction",
	"suggestion",
	"special",
];

export const AchievementsCommand = defineCommand({
	name: "achievements",
	description: "View achievements for yourself or another member",
	options: {
		member: option.member({
			description: "The member to view achievements for",
		}),
		category: option.string({
			description: "Filter by category",
			choices: [
				{ name: "Bump Achievements", value: "bump" },
				{ name: "Daily Achievements", value: "daily" },
				{ name: "Level Achievements", value: "level" },
				{ name: "Starboard Achievements", value: "starboard" },
				{ name: "Reaction Achievements", value: "reaction" },
				{ name: "Introduction Achievements", value: "introduction" },
				{ name: "Suggestion Achievements", value: "suggestion" },
				{ name: "Special Achievements", value: "special" },
			],
		}),
	},

	async handle(interaction, { member = interaction.member, category }) {
		const targetUser = member.user;

		await interaction.deferReply();

		const categoryFilter = category as AchievementCategory | undefined;

		const userId = BigInt(targetUser.id);
		const achievementsWithStatus = await getAchievementsWithStatus(userId);
		const progress = await getAchievementProgress(userId);

		// Build the embed
		const embed = createStandardEmbed(member)
			.setTitle(`Achievements for ${fakeMention(targetUser)}`)
			.setThumbnail(targetUser.displayAvatarURL({ size: 128 }));

		// Filter categories if specified
		const categoriesToShow = categoryFilter ? [categoryFilter] : CATEGORY_ORDER;

		for (const category of categoriesToShow) {
			const categoryInfo = CATEGORY_INFO[category];
			const categoryAchievements = achievementsWithStatus.filter(
				(a) => a.definition.category === category,
			);

			const categoryProgress = progress.byCategory[category];

			// Build achievement lines
			const lines = categoryAchievements.map((achievement) => {
				const { definition, unlocked, unlockedAt } = achievement;
				if (unlocked && unlockedAt) {
					const dateStr = formatDate(unlockedAt);
					return `✅ ${definition.emoji} ${definition.name} - *${dateStr}*`;
				}
				return `⬛ ${definition.emoji} ${definition.name}`;
			});

			const fieldName = `${categoryInfo.emoji} ${categoryInfo.name} (${categoryProgress.unlocked}/${categoryProgress.total})`;
			const fieldValue = lines.join("\n") || "No achievements in this category";

			embed.addFields({
				name: fieldName,
				value: fieldValue,
				inline: false,
			});
		}

		// Add progress footer
		embed.setFooter({
			text: `Progress: ${progress.unlocked}/${progress.total} achievements unlocked`,
		});

		await interaction.followUp({ embeds: [embed] });
	},
});

/**
 * Format a date for display.
 */
function formatDate(date: Date): string {
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}
