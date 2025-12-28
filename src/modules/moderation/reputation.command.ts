import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	EmbedBuilder,
	type GuildMember,
	MessageFlags,
	PermissionFlagsBits,
} from "discord.js";
import type { Command, ExecutableSubcommand } from "djs-slash-helper";
import { logger } from "../../logging.js";
import {
	REPUTATION_EVENT_LABELS,
	ReputationEventType,
} from "../../store/models/ReputationEvent.js";
import { fakeMention } from "../../util/users.js";
import { logModerationAction } from "./logs.js";
import {
	getReputationHistoryForUser,
	getReputationTier,
	getUserReputation,
	grantReputation,
	REPUTATION_TIER_COLORS,
	REPUTATION_TIER_LABELS,
	REPUTATION_TIER_THRESHOLDS,
	ReputationTier,
	updateReputation,
} from "./reputation.service.js";

// Grantable positive reputation types
const grantableTypes = [
	{
		name: "Helped User (+10)",
		value: ReputationEventType.HELPED_USER,
	},
	{
		name: "Quality Contribution (+15)",
		value: ReputationEventType.QUALITY_CONTRIBUTION,
	},
	{
		name: "Valid Report (+20)",
		value: ReputationEventType.VALID_REPORT,
	},
	{
		name: "Custom Amount",
		value: ReputationEventType.MANUAL_GRANT,
	},
];

const ViewSubcommand: ExecutableSubcommand = {
	type: ApplicationCommandOptionType.Subcommand,
	name: "view",
	description: "View a user's reputation",
	options: [
		{
			type: ApplicationCommandOptionType.User,
			name: "user",
			description: "The user to check",
			required: true,
		},
	],
	async handle(interaction) {
		const member = interaction.member as GuildMember | null;
		if (!member) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "This command must be used in a server.",
			});
		}
		if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "You don't have permission to view reputation.",
			});
		}

		const targetUser = interaction.options.getUser("user", true);

		try {
			const reputation = await getUserReputation(BigInt(targetUser.id));
			const history = await getReputationHistoryForUser(
				BigInt(targetUser.id),
				5,
			);

			const tierEmoji = getTierEmoji(reputation.tier);
			const progressToNextTier = getProgressToNextTier(
				reputation.score,
				reputation.tier,
			);

			const embed = new EmbedBuilder()
				.setTitle(`Reputation: ${targetUser.username}`)
				.setColor(reputation.tierColor)
				.setThumbnail(targetUser.displayAvatarURL())
				.addFields(
					{
						name: "Score",
						value: formatScore(reputation.score),
						inline: true,
					},
					{
						name: "Tier",
						value: `${tierEmoji} ${reputation.tierLabel}`,
						inline: true,
					},
					{
						name: "Progress",
						value: progressToNextTier,
						inline: true,
					},
				)
				.setTimestamp();

			if (history.length > 0) {
				const recentEvents = history
					.map((event) => {
						const sign = event.scoreChange >= 0 ? "+" : "";
						const label = REPUTATION_EVENT_LABELS[event.eventType];
						const time = `<t:${Math.floor(event.createdAt.getTime() / 1000)}:R>`;
						return `${sign}${event.scoreChange} - ${label} (${time})`;
					})
					.join("\n");

				embed.addFields({
					name: "Recent Activity",
					value: recentEvents,
					inline: false,
				});
			}

			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				embeds: [embed],
			});
		} catch (error) {
			logger.error("Failed to fetch reputation:", error);
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "Failed to fetch reputation data.",
			});
		}
	},
};

const GrantSubcommand: ExecutableSubcommand = {
	type: ApplicationCommandOptionType.Subcommand,
	name: "grant",
	description: "Grant positive reputation to a user",
	options: [
		{
			type: ApplicationCommandOptionType.User,
			name: "user",
			description: "The user to grant reputation to",
			required: true,
		},
		{
			type: ApplicationCommandOptionType.String,
			name: "type",
			description: "Type of reputation to grant",
			required: true,
			choices: grantableTypes,
		},
		{
			type: ApplicationCommandOptionType.String,
			name: "reason",
			description: "Reason for granting reputation",
			required: true,
		},
		{
			type: ApplicationCommandOptionType.Integer,
			name: "amount",
			description: "Custom amount (only for Custom Amount type)",
			required: false,
			min_value: 1,
			max_value: 100,
		},
	],
	async handle(interaction) {
		const member = interaction.member as GuildMember | null;
		if (!member) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "This command must be used in a server.",
			});
		}
		if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "You don't have permission to grant reputation.",
			});
		}

		const targetUser = interaction.options.getUser("user", true);
		const eventTypeStr = interaction.options.getString("type", true);
		const reason = interaction.options.getString("reason", true);
		const customAmount = interaction.options.getInteger("amount");

		// Validate event type is one of the allowed grantable types
		const validEventTypes = grantableTypes.map((t) => t.value);
		if (!validEventTypes.includes(eventTypeStr as ReputationEventType)) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "Invalid reputation type.",
			});
		}
		const eventType = eventTypeStr as ReputationEventType;

		if (targetUser.bot) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "Cannot grant reputation to bots.",
			});
		}

		if (
			eventType === ReputationEventType.MANUAL_GRANT &&
			customAmount === null
		) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "Please provide an amount for custom reputation grants.",
			});
		}

		try {
			// Use custom score for manual grants, otherwise use the default
			const options =
				eventType === ReputationEventType.MANUAL_GRANT && customAmount
					? { customScore: customAmount }
					: undefined;

			const result = await grantReputation(
				BigInt(targetUser.id),
				eventType,
				BigInt(interaction.user.id),
				reason,
				undefined,
				options?.customScore,
			);

			// Log the reputation grant
			await logModerationAction(interaction.client, {
				kind: "ReputationGranted",
				moderator: interaction.user,
				target: targetUser,
				eventType: REPUTATION_EVENT_LABELS[eventType],
				scoreChange: result.event.scoreChange,
				newScore: result.newScore,
				reason,
			});

			const tierChange = result.tierChanged
				? `\nTier changed: **${REPUTATION_TIER_LABELS[result.newTier]}**`
				: "";

			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content:
					`Granted **+${result.event.scoreChange}** reputation to ${fakeMention(targetUser)}\n` +
					`**Reason:** ${reason}\n` +
					`**New Score:** ${formatScore(result.newScore)}${tierChange}`,
			});
		} catch (error) {
			logger.error("Failed to grant reputation:", error);
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "Failed to grant reputation.",
			});
		}
	},
};

const HistorySubcommand: ExecutableSubcommand = {
	type: ApplicationCommandOptionType.Subcommand,
	name: "history",
	description: "View a user's reputation history",
	options: [
		{
			type: ApplicationCommandOptionType.User,
			name: "user",
			description: "The user to check",
			required: true,
		},
		{
			type: ApplicationCommandOptionType.Integer,
			name: "limit",
			description: "Number of events to show (default: 20)",
			required: false,
			min_value: 5,
			max_value: 50,
		},
	],
	async handle(interaction) {
		const member = interaction.member as GuildMember | null;
		if (!member) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "This command must be used in a server.",
			});
		}
		if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "You don't have permission to view reputation history.",
			});
		}

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const targetUser = interaction.options.getUser("user", true);
		const limit = interaction.options.getInteger("limit") ?? 20;

		try {
			const history = await getReputationHistoryForUser(
				BigInt(targetUser.id),
				limit,
			);
			const reputation = await getUserReputation(BigInt(targetUser.id));

			if (history.length === 0) {
				return await interaction.editReply({
					content: `${fakeMention(targetUser)} has no reputation history.`,
				});
			}

			const embed = new EmbedBuilder()
				.setTitle(`Reputation History: ${targetUser.username}`)
				.setColor(reputation.tierColor)
				.setThumbnail(targetUser.displayAvatarURL())
				.setDescription(
					`**Current Score:** ${formatScore(reputation.score)} (${reputation.tierLabel})`,
				)
				.setTimestamp();

			// Group events by date
			const eventLines = history.map((event) => {
				const sign = event.scoreChange >= 0 ? "+" : "";
				const label = REPUTATION_EVENT_LABELS[event.eventType];
				const time = `<t:${Math.floor(event.createdAt.getTime() / 1000)}:f>`;
				const reason = event.reason ? ` - ${event.reason.slice(0, 50)}` : "";
				return `\`${sign}${event.scoreChange.toString().padStart(3)}\` ${label}${reason}\n  ${time}`;
			});

			// Split into chunks if too long
			const chunkSize = 10;
			for (let i = 0; i < eventLines.length; i += chunkSize) {
				const chunk = eventLines.slice(i, i + chunkSize);
				embed.addFields({
					name: i === 0 ? "Events" : "\u200b",
					value: chunk.join("\n"),
					inline: false,
				});
			}

			return await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			logger.error("Failed to fetch reputation history:", error);
			return await interaction.editReply({
				content: "Failed to fetch reputation history.",
			});
		}
	},
};

function getTierEmoji(tier: ReputationTier): string {
	switch (tier) {
		case ReputationTier.TRUSTED:
			return "🌟";
		case ReputationTier.GOOD:
			return "✅";
		case ReputationTier.NEUTRAL:
			return "➖";
		case ReputationTier.WATCH:
			return "⚠️";
		case ReputationTier.RESTRICTED:
			return "🚫";
		default:
			return "❓";
	}
}

function formatScore(score: number): string {
	if (score >= 0) {
		return `+${score}`;
	}
	return score.toString();
}

function getProgressToNextTier(
	score: number,
	currentTier: ReputationTier,
): string {
	const tiers = [
		ReputationTier.RESTRICTED,
		ReputationTier.WATCH,
		ReputationTier.NEUTRAL,
		ReputationTier.GOOD,
		ReputationTier.TRUSTED,
	];

	const currentIndex = tiers.indexOf(currentTier);

	if (currentTier === ReputationTier.TRUSTED) {
		return "Max tier reached";
	}

	const nextTier = tiers[currentIndex + 1];
	const nextThreshold = REPUTATION_TIER_THRESHOLDS[nextTier];
	const pointsNeeded = nextThreshold - score;

	return `${pointsNeeded} to ${REPUTATION_TIER_LABELS[nextTier]}`;
}

export const ReputationCommand: Command<ApplicationCommandType.ChatInput> = {
	name: "reputation",
	description: "Manage user reputation (mods only)",
	type: ApplicationCommandType.ChatInput,
	default_permission: false,
	options: [ViewSubcommand, GrantSubcommand, HistorySubcommand],
	handle() {},
};
