/**
 * /achievements command
 *
 * Displays a user's achievements grouped by category.
 */

import { defineCommand, option } from "../../commands/index.js";
import type { AchievementCategory } from "./achievementDefinitions.js";
import {
	getAchievementProgress,
	getAchievementsWithStatus,
} from "./achievementService.js";
import { renderAchievementList } from "./achievements.cards.js";

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
		await interaction.deferReply();

		const userId = BigInt(member.id);
		const achievements = await getAchievementsWithStatus(userId);
		const progress = await getAchievementProgress(userId);

		await interaction.followUp(
			renderAchievementList(
				member,
				category ? [category as AchievementCategory] : CATEGORY_ORDER,
				achievements.map(({ definition, unlocked, unlockedAt }) => ({
					definition,
					unlocked,
					unlockedAt,
				})),
				progress,
			),
		);
	},
});
