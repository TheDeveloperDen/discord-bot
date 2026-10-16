import type { GuildMember } from "discord.js";
import { Message, renderDiscordMessage } from "disjsx";
import { Card, Field, memberAuthor, withoutPings } from "../../ui/index.js";
import {
	type AchievementCategory,
	type AchievementDefinition,
	CATEGORY_INFO,
} from "./achievementDefinitions.js";

interface Progress {
	total: number;
	unlocked: number;
	byCategory: Record<AchievementCategory, { total: number; unlocked: number }>;
}

const render = (card: React.ReactElement) =>
	withoutPings(renderDiscordMessage(<Message isV2>{card}</Message>));

const capitalise = (text: string) =>
	text.charAt(0).toUpperCase() + text.slice(1);

/** Sent when a member unlocks one achievement */
export function renderAchievementUnlocked(
	member: GuildMember,
	achievement: AchievementDefinition,
	progress: Progress,
) {
	return render(
		<Card
			title="Achievement Unlocked!"
			author={memberAuthor(member)}
			description={`Earned **${achievement.name}**!\n> ${achievement.description}`}
			footer={`${capitalise(achievement.category)} Achievements | ${progress.unlocked}/${progress.total} total`}
		/>,
	);
}

/** Sent when a member unlocks several at once */
export function renderAchievementsUnlocked(
	member: GuildMember,
	achievements: AchievementDefinition[],
	progress: Progress,
) {
	return render(
		<Card
			title={`${achievements.length} Achievements Unlocked!`}
			author={memberAuthor(member)}
			description={`Earned:\n\n${achievements
				.map((a) => `${a.emoji} **${a.name}** - ${a.description}`)
				.join("\n")}`}
			footer={`${progress.unlocked}/${progress.total} achievements unlocked`}
		/>,
	);
}

export interface AchievementLine {
	definition: AchievementDefinition;
	unlockedAt?: Date | null;
	unlocked: boolean;
}

const formatDate = (date: Date) =>
	date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});

/** The `/achievements` list, one section per category */
export function renderAchievementList(
	member: GuildMember,
	categories: AchievementCategory[],
	achievements: AchievementLine[],
	progress: Progress,
) {
	return render(
		<Card
			title={`Achievements for ${member.displayName}`}
			author={memberAuthor(member)}
			footer={`Progress: ${progress.unlocked}/${progress.total} achievements unlocked`}
		>
			{categories.map((category) => {
				const info = CATEGORY_INFO[category];
				const { unlocked, total } = progress.byCategory[category];
				const lines = achievements
					.filter((a) => a.definition.category === category)
					.map(({ definition, unlocked, unlockedAt }) =>
						unlocked && unlockedAt
							? `✅ ${definition.emoji} ${definition.name} - *${formatDate(unlockedAt)}*`
							: `⬛ ${definition.emoji} ${definition.name}`,
					);
				return (
					<Field
						key={category}
						label={`${info.emoji} ${info.name} (${unlocked}/${total})`}
					>
						{lines.join("\n") || "No achievements in this category"}
					</Field>
				);
			})}
		</Card>,
	);
}
