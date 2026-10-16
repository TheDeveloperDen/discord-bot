import { describe, expect, test } from "bun:test";
import type { GuildMember } from "discord.js";
import { texts } from "../../tests/render.js";
import type { AchievementDefinition } from "./achievementDefinitions.js";
import {
	renderAchievementList,
	renderAchievementsUnlocked,
	renderAchievementUnlocked,
} from "./achievements.cards.js";

const member = {
	id: "42",
	displayName: "Ada",
	displayColor: 0,
	displayAvatarURL: () => "https://example.com/a.png",
} as unknown as GuildMember;

const first = {
	id: "bump_1",
	name: "First Bump",
	description: "Bump once",
	emoji: "🎯",
	category: "bump",
} as AchievementDefinition;

const progress = {
	total: 10,
	unlocked: 3,
	byCategory: {
		bump: { total: 2, unlocked: 1 },
		daily: { total: 0, unlocked: 0 },
		level: { total: 0, unlocked: 0 },
		starboard: { total: 0, unlocked: 0 },
		reaction: { total: 0, unlocked: 0 },
		introduction: { total: 0, unlocked: 0 },
		suggestion: { total: 0, unlocked: 0 },
		special: { total: 0, unlocked: 0 },
	},
};

describe("achievement cards", () => {
	test("an unlock names the achievement and never pings", () => {
		const message = renderAchievementUnlocked(member, first, progress);
		expect(message.allowedMentions).toEqual({ parse: [] });
		const text = texts(message as never).join("\n");
		expect(text).toContain("<@42>");
		expect(text).toContain("**First Bump**");
		expect(text).toContain("Bump once");
		expect(text).toContain("Bump Achievements | 3/10 total");
	});

	test("a group lists every achievement", () => {
		const text = texts(
			renderAchievementsUnlocked(member, [first, first], progress) as never,
		).join("\n");
		expect(text).toContain("2 Achievements Unlocked!");
		expect(text.match(/First Bump/g)).toHaveLength(2);
	});

	test("the list marks unlocked ones with their date", () => {
		const text = texts(
			renderAchievementList(
				member,
				["bump"],
				[
					{
						definition: first,
						unlocked: true,
						unlockedAt: new Date("2026-01-02T12:00:00Z"),
					},
					{ definition: { ...first, name: "Locked" }, unlocked: false },
				],
				progress,
			) as never,
		).join("\n");
		expect(text).toContain("Bump Achievements (1/2)");
		expect(text).toContain("✅ 🎯 First Bump - *Jan 2, 2026*");
		expect(text).toContain("⬛ 🎯 Locked");
	});
});
