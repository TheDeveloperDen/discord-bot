import { defineCommand, option } from "../../commands/index.js";
import { definePaginator } from "../../ui/index.js";
import { LeaderboardCard } from "./leaderboard.card.js";
import {
	getLeaderboardPage,
	leaderboardFor,
	leaderboards,
} from "./leaderboard.js";

export const LeaderboardPages = definePaginator({
	id: "leaderboard:page",
	args: ["type"],
	pageSize: 10,
	fetch: ({ type }, request) =>
		getLeaderboardPage(leaderboardFor(type), request),
	render: ({ items, offset, footer }, { type }) => (
		<LeaderboardCard
			leaderboard={leaderboardFor(type)}
			entries={items}
			offset={offset}
			footer={footer}
		/>
	),
});

export const LeaderboardCommand = defineCommand({
	name: "leaderboard",
	description: "Show the leaderboard for XP, level, daily streaks or bumps",
	options: {
		type: option.string({
			description: "The type of leaderboard to show",
			required: true,
			choices: leaderboards.map(({ name, value }) => ({ name, value })),
		}),
	},

	async handle(interaction, { type }) {
		await interaction.deferReply();
		await interaction.followUp(
			await LeaderboardPages.message({ type }, { owner: interaction.user.id }),
		);
	},
});
