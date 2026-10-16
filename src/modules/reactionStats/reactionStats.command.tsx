import type { Guild } from "discord.js";
import { Message, renderDiscordMessage } from "disjsx";
import { defineCommand, option, subcommand } from "../../commands/index.js";
import {
	Card,
	Details,
	Field,
	memberAuthor,
	withoutPings,
} from "../../ui/index.js";
import { actualMention } from "../../util/users.js";
import { medal } from "../leaderboard/leaderboard.js";
import { fitLines, formatEmojiForEmbed } from "./reactionStats.embed.js";
import {
	getGlobalStats,
	getTopMessages,
	getUserStats,
	periodLabel,
	type TimePeriod,
} from "./reactionStats.service.js";

const MAX_LIST_LENGTH = 1000;
const MAX_RESULTS_LENGTH = 3000;

const render = (card: React.ReactElement) =>
	withoutPings(renderDiscordMessage(<Message isV2>{card}</Message>));

function canRenderCustomEmoji(
	guild: Guild,
	emojiId: bigint | null,
): boolean | undefined {
	if (!emojiId) return undefined;
	return guild.client.emojis.resolve(emojiId.toString()) !== null;
}

const periodChoices = [
	{ name: "All Time", value: "all" },
	{ name: "Last Year", value: "year" },
	{ name: "Last 30 Days", value: "month" },
	{ name: "Last 7 Days", value: "week" },
	{ name: "Last 24 Hours", value: "day" },
] as const satisfies { name: string; value: TimePeriod }[];

const UserSubcommand = subcommand({
	description: "View reaction stats for a specific user",
	options: {
		target: option.user({
			description: "The user to view stats for (defaults to yourself)",
		}),
		period: option.string({
			description: "Time period to filter by",
			choices: periodChoices,
		}),
	},
	async handle(interaction, { target, period = "all" }) {
		await interaction.deferReply();
		const guild = interaction.guild;

		const targetUser = target ?? interaction.user;

		const stats = await getUserStats(BigInt(targetUser.id), period);

		if (stats.totalReactions === 0) {
			await interaction.followUp(
				render(
					<Card
						accent={memberAuthor(interaction.member).color}
						title={`Reaction Stats: ${targetUser.username}`}
						author={memberAuthor(targetUser)}
						description={`No reactions recorded for ${actualMention(targetUser)} (${periodLabel(period)}).`}
					/>,
				),
			);
			return;
		}

		const emojiLines = stats.topEmojis.map(
			(e, i) =>
				`${medal(i)} ${formatEmojiForEmbed(
					e.emojiName,
					e.isCustomEmoji,
					e.emojiId,
					{
						canRenderCustomEmoji: canRenderCustomEmoji(guild, e.emojiId),
					},
				)} — **${e.count}** time${e.count !== 1 ? "s" : ""}`,
		);

		await interaction.followUp(
			render(
				<Card
					accent={memberAuthor(interaction.member).color}
					title={`Reaction Stats: ${targetUser.username}`}
					author={memberAuthor(targetUser)}
					description={`Stats for ${actualMention(targetUser)}`}
				>
					<Details
						items={[
							["Period", periodLabel(period)],
							["Total Reactions", stats.totalReactions.toLocaleString()],
							[
								"Messages Reacted To",
								stats.uniqueMessagesReacted.toLocaleString(),
							],
						]}
					/>
					{emojiLines.length > 0 && (
						<Field label={`Top ${emojiLines.length} Emojis`}>
							{fitLines(emojiLines, MAX_LIST_LENGTH)}
						</Field>
					)}
				</Card>,
			),
		);
	},
});

const GlobalSubcommand = subcommand({
	description: "View global reaction statistics",
	options: {
		period: option.string({
			description: "Time period to filter by",
			choices: periodChoices,
		}),
	},
	async handle(interaction, { period = "all" }) {
		await interaction.deferReply();
		const guild = interaction.guild;

		const stats = await getGlobalStats(period);

		if (stats.totalReactions === 0) {
			await interaction.followUp(
				render(
					<Card
						accent={memberAuthor(interaction.member).color}
						title="Global Reaction Stats"
						description={`No reactions recorded (${periodLabel(period)}).`}
					/>,
				),
			);
			return;
		}

		const reactorLines = await Promise.all(
			stats.topReactors.map(async (r, i) => {
				const user = await guild.client.users
					.fetch(r.userId.toString())
					.catch(() => null);
				const mention = user ? actualMention(user) : "Unknown User";
				return `${medal(i)} ${mention} — **${r.count}** reaction${r.count !== 1 ? "s" : ""}`;
			}),
		);

		const emojiLines = stats.topEmojis.map(
			(e, i) =>
				`${medal(i)} ${formatEmojiForEmbed(
					e.emojiName,
					e.isCustomEmoji,
					e.emojiId,
					{
						canRenderCustomEmoji: canRenderCustomEmoji(guild, e.emojiId),
					},
				)} — **${e.count}** time${e.count !== 1 ? "s" : ""}`,
		);

		const receiverLines = await Promise.all(
			stats.topReceivers.map(async (r, i) => {
				const user = await guild.client.users
					.fetch(r.messageAuthorId.toString())
					.catch(() => null);
				const mention = user ? actualMention(user) : "Unknown User";
				return `${medal(i)} ${mention} — **${r.count}** reaction${r.count !== 1 ? "s" : ""} received`;
			}),
		);

		await interaction.followUp(
			render(
				<Card
					accent={memberAuthor(interaction.member).color}
					title="Global Reaction Stats"
				>
					<Details
						items={[
							["Period", periodLabel(period)],
							["Total Reactions", stats.totalReactions.toLocaleString()],
						]}
					/>
					{reactorLines.length > 0 && (
						<Field label="🏆 Top Reactors">
							{fitLines(reactorLines, MAX_LIST_LENGTH)}
						</Field>
					)}
					{emojiLines.length > 0 && (
						<Field label="🔥 Most Used Emojis">
							{fitLines(emojiLines, MAX_LIST_LENGTH)}
						</Field>
					)}
					{receiverLines.length > 0 && (
						<Field label="💬 Most Reacted Users (received)">
							{fitLines(receiverLines, MAX_LIST_LENGTH)}
						</Field>
					)}
				</Card>,
			),
		);
	},
});

const MessagesSubcommand = subcommand({
	description: "View the most reacted messages",
	options: {
		period: option.string({
			description: "Time period to filter by",
			choices: periodChoices,
		}),
	},
	async handle(interaction, { period = "all" }) {
		await interaction.deferReply();
		const guild = interaction.guild;

		const topMessages = await getTopMessages(period);

		if (topMessages.length === 0) {
			await interaction.followUp(
				render(
					<Card
						accent={memberAuthor(interaction.member).color}
						title="Most Reacted Messages"
						description={`No reactions recorded (${periodLabel(period)}).`}
					/>,
				),
			);
			return;
		}

		const messageLines = await Promise.all(
			topMessages.map(async (m, i) => {
				const author = await guild.client.users
					.fetch(m.messageAuthorId.toString())
					.catch(() => null);
				const authorName = author ? actualMention(author) : "Unknown User";
				const messageLink = `https://discord.com/channels/${guild.id}/${m.channelId}/${m.messageId}`;
				return (
					`${medal(i)} **#${i + 1}** — [Jump to message](${messageLink})\n` +
					`  By ${authorName} • **${m.reactionCount}** reaction${m.reactionCount !== 1 ? "s" : ""} from **${m.uniqueReactors}** user${m.uniqueReactors !== 1 ? "s" : ""}`
				);
			}),
		);

		await interaction.followUp(
			render(
				<Card
					accent={memberAuthor(interaction.member).color}
					title="Most Reacted Messages"
				>
					<Details items={[["Period", periodLabel(period)]]} />
					<Field label="Results">
						{fitLines(messageLines, MAX_RESULTS_LENGTH, "\n\n")}
					</Field>
				</Card>,
			),
		);
	},
});

export const ReactionStatsCommand = defineCommand({
	name: "reactionstats",
	description: "View reaction statistics for users, emojis, and messages",
	subcommands: {
		user: UserSubcommand,
		global: GlobalSubcommand,
		messages: MessagesSubcommand,
	},
});
