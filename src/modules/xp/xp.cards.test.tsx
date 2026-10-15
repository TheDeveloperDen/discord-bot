import { describe, expect, test } from "bun:test";
import { ComponentType } from "discord.js";
import type { ReactElement } from "react";
import { flatten, renderV2, texts } from "../../tests/render.js";
import { xpForLevel } from "./levels.js";
import { DailyRewardCard, LevelUpCard, ProfileCard } from "./xp.cards.js";

const all = (element: ReactElement) => texts(renderV2(element));

const author = { name: "Alice", userId: "1", iconUrl: "https://cdn/a.png" };

/** The texts in the section beside the avatar, then everything after it */
function sections(element: ReactElement) {
	const components = flatten(renderV2(element));
	const header = components.find((c) => c.type === ComponentType.Section);
	return {
		header: header?.components?.map((c) => c.content) ?? [],
		avatar: header?.accessory?.media?.url,
		types: components.map((c) => c.type),
		texts: all(element),
	};
}

describe("ProfileCard", () => {
	// level 12 runs from 7,116 to 8,385 XP
	const element = (
		<ProfileCard
			author={author}
			level={12}
			xp={8000n}
			currentStreak={3}
			highestStreak={10}
			bumps={4}
			tierRole="222"
		/>
	);

	test("puts the name, level and stats beside the avatar", () => {
		const { header, avatar } = sections(element);

		expect(header).toEqual([
			"## Alice",
			"**Level 12** | <@&222>",
			"🔥 3 days (max 10) | 📣 4 bumps",
		]);
		expect(avatar).toBe("https://cdn/a.png");
	});

	test("shows progress through the level on one line below a divider", () => {
		const { types, texts } = sections(element);

		expect(types.filter((t) => t === ComponentType.Separator)).toHaveLength(1);
		expect(texts).toContain("**XP** 8,000 / 8,385   ▰▰▰▰▰▰▰▱▱▱ 70%");
		expect(texts.at(-1)).toContain("385 XP to level 13");
	});
});

describe("member colour", () => {
	const coloured = { ...author, color: 0x3498db };
	const accent = (element: ReactElement) =>
		flatten(renderV2(element)).find((c) => c.type === ComponentType.Container)
			?.accent_color;

	test("every card is accented with the member's role colour", () => {
		expect(
			accent(
				<ProfileCard
					author={coloured}
					level={1}
					xp={0n}
					currentStreak={0}
					highestStreak={0}
					bumps={0}
				/>,
			),
		).toBe(0x3498db);
		expect(
			accent(<DailyRewardCard author={coloured} streak={1} xpGiven={50} />),
		).toBe(0x3498db);
		expect(
			accent(<LevelUpCard greeting="hi" author={coloured} level={2} xp={0n} />),
		).toBe(0x3498db);
	});
});

describe("DailyRewardCard", () => {
	test("adds a flame for every 50 days past 100", () => {
		const shown = all(
			<DailyRewardCard
				author={author}
				streak={160}
				xpGiven={1640}
				multiplier={2}
			/>,
		).join("\n");

		expect(shown).toContain("📆 Current streak: 160 days 🔥🔥");
		expect(shown).toContain("⭐ +1640 XP (x2)");
	});

	test("has no flames or multiplier for a short streak", () => {
		const shown = all(
			<DailyRewardCard author={author} streak={1} xpGiven={50} />,
		).join("\n");

		expect(shown).toContain("📆 Current streak: 1 day\n");
		expect(shown).toContain("⭐ +50 XP\n");
	});
});

describe("LevelUpCard", () => {
	// level-ups happen as XP crosses the threshold, so these start each level with 0 XP into it
	const card = (level: number, extra: { tierRole?: string } = {}) => (
		<LevelUpCard
			greeting="<@1> (Don't want to be pinged? ...)"
			author={author}
			level={level}
			xp={xpForLevel(level)}
			{...extra}
		/>
	);

	test("celebrates beside the avatar with the tier in its role colour", () => {
		const { header, avatar, texts } = sections(card(13, { tierRole: "222" }));

		expect(texts[0]).toBe("<@1> (Don't want to be pinged? ...)");
		expect(header).toEqual([
			"## ⚡ Level 13!",
			"**Alice** levelled up | <@&222>",
		]);
		expect(avatar).toBe("https://cdn/a.png");
	});

	test("shows the tier in bold without a role", () => {
		expect(sections(card(13)).header).toContain(
			"**Alice** levelled up | **Tier 2**",
		);
	});

	test("shows progress through the tier, and what the next level needs", () => {
		const { texts } = sections(card(13));

		expect(texts).toContain("▰▰▰▱▱▱▱▱▱▱ next tier at level 20");
		expect(texts.at(-1)).toContain("1,401 XP to level 14");
	});

	test("starts the first tier from level 0", () => {
		expect(sections(card(5)).texts).toContain(
			"▰▰▰▰▰▱▱▱▱▱ next tier at level 10",
		);
	});

	test("calls out a new tier and starts its bar empty", () => {
		const { header, texts } = sections(card(20));

		expect(header).toContain("🎉 New tier unlocked!");
		expect(texts).toContain("▱▱▱▱▱▱▱▱▱▱ next tier at level 30");
	});

	test("mentions the member only in the greeting", () => {
		const [, ...rest] = sections(card(13)).texts;

		expect(rest.join("\n")).not.toContain("<@1>");
	});
});
