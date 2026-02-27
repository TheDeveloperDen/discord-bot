import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	type GuildMember,
} from "discord.js";
import type { Command, ExecutableSubcommand } from "djs-slash-helper";
import { wrapInTransaction } from "../../sentry.js";
import { createStandardEmbed } from "../../util/embeds.js";
import { actualMention } from "../../util/users.js";
import { medal } from "../leaderboard/leaderboard.js";
import {
	formatEmoji,
	getGlobalStats,
	getTopMessages,
	getUserStats,
	periodLabel,
	type TimePeriod,
} from "./reactionStats.service.js";

const periodChoices = [
	{ name: "All Time", value: "all" },
	{ name: "Last Year", value: "year" },
	{ name: "Last 30 Days", value: "month" },
	{ name: "Last 7 Days", value: "week" },
	{ name: "Last 24 Hours", value: "day" },
];

const UserSubcommand: ExecutableSubcommand = {
	type: ApplicationCommandOptionType.Subcommand,
	name: "user",
	description: "View reaction stats for a specific user",
	options: [
		{
			type: ApplicationCommandOptionType.User,
			name: "target",
			description: "The user to view stats for (defaults to yourself)",
			required: false,
		},
		{
			type: ApplicationCommandOptionType.String,
			name: "period",
			description: "Time period to filter by",
			required: false,
			choices: periodChoices,
		},
	],
	handle: wrapInTransaction("reactionstats-user", async (_, interaction) => {
		await interaction.deferReply();
		const guild = interaction.guild;
		if (!guild) {
			await interaction.followUp("This command can only be used in a server.");
			return;
		}

		const targetUser =
			interaction.options.getUser("target") ?? interaction.user;
		const period = (interaction.options.getString("period") ??
			"all") as TimePeriod;

		const stats = await getUserStats(BigInt(targetUser.id), period);

		if (stats.totalReactions === 0) {
			await interaction.followUp({
				embeds: [
					createStandardEmbed(interaction.member as GuildMember)
						.setTitle(`Reaction Stats: ${targetUser.username}`)
						.setThumbnail(targetUser.displayAvatarURL())
						.setDescription(
							`No reactions recorded for ${actualMention(targetUser)} (${periodLabel(period)}).`,
						),
				],
			});
			return;
		}

		const emojiLines = stats.topEmojis.map(
			(e, i) =>
				`${medal(i)} ${formatEmoji(e.emojiName, e.isCustomEmoji, e.emojiId)} — **${e.count}** time${e.count !== 1 ? "s" : ""}`,
		);

		const embed = createStandardEmbed(interaction.member as GuildMember)
			.setTitle(`Reaction Stats: ${targetUser.username}`)
			.setThumbnail(targetUser.displayAvatarURL())
			.setDescription(`Stats for ${actualMention(targetUser)}`)
			.addFields(
				{
					name: "Period",
					value: periodLabel(period),
					inline: true,
				},
				{
					name: "Total Reactions",
					value: stats.totalReactions.toLocaleString(),
					inline: true,
				},
				{
					name: "Messages Reacted To",
					value: stats.uniqueMessagesReacted.toLocaleString(),
					inline: true,
				},
			);

		if (emojiLines.length > 0) {
			embed.addFields({
				name: `Top ${emojiLines.length} Emojis`,
				value: emojiLines.join("\n"),
				inline: false,
			});
		}

		await interaction.followUp({ embeds: [embed] });
	}),
};

const GlobalSubcommand: ExecutableSubcommand = {
	type: ApplicationCommandOptionType.Subcommand,
	name: "global",
	description: "View global reaction statistics",
	options: [
		{
			type: ApplicationCommandOptionType.String,
			name: "period",
			description: "Time period to filter by",
			required: false,
			choices: periodChoices,
		},
	],
	handle: wrapInTransaction("reactionstats-global", async (_, interaction) => {
		await interaction.deferReply();
		const guild = interaction.guild;
		if (!guild) {
			await interaction.followUp("This command can only be used in a server.");
			return;
		}

		const period = (interaction.options.getString("period") ??
			"all") as TimePeriod;
		const stats = await getGlobalStats(period);

		if (stats.totalReactions === 0) {
			await interaction.followUp({
				embeds: [
					createStandardEmbed(interaction.member as GuildMember)
						.setTitle("Global Reaction Stats")
						.setDescription(`No reactions recorded (${periodLabel(period)}).`),
				],
			});
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
				`${medal(i)} ${formatEmoji(e.emojiName, e.isCustomEmoji, e.emojiId)} — **${e.count}** time${e.count !== 1 ? "s" : ""}`,
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

		const embed = createStandardEmbed(interaction.member as GuildMember)
			.setTitle("Global Reaction Stats")
			.addFields(
				{
					name: "Period",
					value: periodLabel(period),
					inline: true,
				},
				{
					name: "Total Reactions",
					value: stats.totalReactions.toLocaleString(),
					inline: true,
				},
			);

		if (reactorLines.length > 0) {
			embed.addFields({
				name: "🏆 Top Reactors",
				value: reactorLines.join("\n"),
				inline: false,
			});
		}

		if (emojiLines.length > 0) {
			embed.addFields({
				name: "🔥 Most Used Emojis",
				value: emojiLines.join("\n"),
				inline: false,
			});
		}

		if (receiverLines.length > 0) {
			embed.addFields({
				name: "💬 Most Reacted Users (received)",
				value: receiverLines.join("\n"),
				inline: false,
			});
		}

		await interaction.followUp({ embeds: [embed] });
	}),
};

const MessagesSubcommand: ExecutableSubcommand = {
	type: ApplicationCommandOptionType.Subcommand,
	name: "messages",
	description: "View the most reacted messages",
	options: [
		{
			type: ApplicationCommandOptionType.String,
			name: "period",
			description: "Time period to filter by",
			required: false,
			choices: periodChoices,
		},
	],
	handle: wrapInTransaction(
		"reactionstats-messages",
		async (_, interaction) => {
			await interaction.deferReply();
			const guild = interaction.guild;
			if (!guild) {
				await interaction.followUp(
					"This command can only be used in a server.",
				);
				return;
			}

			const period = (interaction.options.getString("period") ??
				"all") as TimePeriod;
			const topMessages = await getTopMessages(period);

			if (topMessages.length === 0) {
				await interaction.followUp({
					embeds: [
						createStandardEmbed(interaction.member as GuildMember)
							.setTitle("Most Reacted Messages")
							.setDescription(
								`No reactions recorded (${periodLabel(period)}).`,
							),
					],
				});
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

			const embed = createStandardEmbed(interaction.member as GuildMember)
				.setTitle("Most Reacted Messages")
				.addFields(
					{
						name: "Period",
						value: periodLabel(period),
						inline: true,
					},
					{
						name: "Results",
						value: messageLines.join("\n\n"),
						inline: false,
					},
				);

			await interaction.followUp({ embeds: [embed] });
		},
	),
};

export const ReactionStatsCommand: Command<ApplicationCommandType.ChatInput> = {
	type: ApplicationCommandType.ChatInput,
	name: "reactionstats",
	description: "View reaction statistics for users, emojis, and messages",
	options: [UserSubcommand, GlobalSubcommand, MessagesSubcommand],
	handle() {},
};
