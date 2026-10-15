import type { ColorResolvable } from "discord.js";
import { TextDisplay } from "disjsx";
import { Card } from "../../ui/index.js";
import { branding } from "../../util/branding.js";
import { actualMention } from "../../util/users.js";
import {
	type Leaderboard,
	type LeaderboardEntry,
	medal,
} from "./leaderboard.js";

/** One page of a leaderboard. Rows are a single text display, so a page stays well under the component limit */
export function LeaderboardCard({
	leaderboard,
	entries,
	offset,
	footer,
	title = `${branding.name} Leaderboard`,
	accent,
}: {
	leaderboard: Leaderboard;
	entries: LeaderboardEntry[];
	/** Rank of the first entry minus one */
	offset: number;
	footer?: string;
	title?: string;
	accent?: ColorResolvable;
}) {
	const rows = entries.map(({ userId, count }, i) => {
		const rank = offset + i;
		return `${medal(rank)} **#${rank + 1}** ${actualMention(userId)} · ${leaderboard.format(count)}`.trimStart();
	});
	return (
		<Card
			title={title}
			description={`Ranked by ${leaderboard.name}`}
			accent={accent}
			footer={footer}
		>
			<TextDisplay>
				{rows.length > 0
					? rows.join("\n")
					: "Nobody is on this leaderboard yet."}
			</TextDisplay>
		</Card>
	);
}
