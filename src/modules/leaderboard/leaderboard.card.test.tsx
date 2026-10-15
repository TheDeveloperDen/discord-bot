import { describe, expect, test } from "bun:test";
import { renderV2, texts } from "../../tests/render.js";
import { LeaderboardCard } from "./leaderboard.card.js";
import { leaderboardFor } from "./leaderboard.js";

const xp = leaderboardFor("xp");

describe("LeaderboardCard", () => {
	test("ranks the first page with medals and mentions", () => {
		const lines = texts(
			renderV2(
				<LeaderboardCard
					leaderboard={xp}
					entries={[
						{ userId: "1", count: 1500 },
						{ userId: "2", count: 900 },
						{ userId: "3", count: 40 },
						{ userId: "4", count: 7 },
					]}
					offset={0}
				/>,
			),
		);

		expect(lines).toContain(
			[
				"🥇 **#1** <@1> · 1,500 XP",
				"🥈 **#2** <@2> · 900 XP",
				"🥉 **#3** <@3> · 40 XP",
				"**#4** <@4> · 7 XP",
			].join("\n"),
		);
	});

	test("later pages carry on numbering without medals", () => {
		const lines = texts(
			renderV2(
				<LeaderboardCard
					leaderboard={xp}
					entries={[{ userId: "11", count: 5 }]}
					offset={10}
					footer="Page 2 of 2"
				/>,
			),
		);

		expect(lines).toContain("**#11** <@11> · 5 XP");
		expect(lines.at(-1)).toContain("Page 2 of 2");
	});

	test("says so when nobody is on it yet", () => {
		const lines = texts(
			renderV2(<LeaderboardCard leaderboard={xp} entries={[]} offset={0} />),
		);

		expect(lines).toContain("Nobody is on this leaderboard yet.");
	});
});
