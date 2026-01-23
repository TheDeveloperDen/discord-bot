/**
 * /achievements command
 *
 * Displays a user's achievements grouped by category.
 */

import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	type GuildMember,
} from "discord.js";
import type { Command } from "djs-slash-helper";
import { wrapInTransaction } from "../../sentry.js";
import { createStandardEmbed } from "../../util/embeds.js";
import { getResolvedMember } from "../../util/interactions.js";
import { fakeMention } from "../../util/users.js";
import {
	type AchievementCategory,
	CATEGORY_INFO,
} from "./achievementDefinitions.js";
import {
	getAchievementProgress,
	getAchievementsWithStatus,
} from "./achievementService.js";

const CATEGORY_ORDER: AchievementCategory[] = ["bump", "daily", "xp"];

export const AchievementsCommand: Command<ApplicationCommandType.ChatInput> = {
	name: "achievements",
	type: ApplicationCommandType.ChatInput,
	description: "View achievements for yourself or another member",
	options: [
		{
			type: ApplicationCommandOptionType.User,
			name: "member",
			description: "The member to view achievements for",
			required: false,
		},
		{
			type: ApplicationCommandOptionType.String,
			name: "category",
			description: "Filter by category",
			required: false,
			choices: [
				{ name: "Bump Achievements", value: "bump" },
				{ name: "Daily Achievements", value: "daily" },
				{ name: "XP Achievements", value: "xp" },
			],
		},
	],

	handle: wrapInTransaction("achievements", async (_, interaction) => {
		await interaction.deferReply();

		const targetUser =
			interaction.options.get("member")?.user ?? interaction.user;
		const member =
			getResolvedMember(interaction.options.get("member")?.member) ??
			(await interaction.guild?.members.fetch(targetUser.id));

		if (!member) {
			await interaction.followUp("Member not found");
			return;
		}

		const categoryFilter = interaction.options.get("category")?.value as
			| AchievementCategory
			| undefined;

		const userId = BigInt(targetUser.id);
		const achievementsWithStatus = await getAchievementsWithStatus(userId);
		const progress = await getAchievementProgress(userId);

		// Build the embed
		const embed = createStandardEmbed(member as GuildMember)
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
	}),
};

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
