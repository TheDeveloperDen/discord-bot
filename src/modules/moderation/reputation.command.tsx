import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { Message, renderDiscordMessage } from "disjsx";
import { defineCommand, option, subcommand } from "../../commands/index.js";
import { logger } from "../../logging.js";
import {
	REPUTATION_EVENT_LABELS,
	ReputationEventType,
} from "../../store/models/ReputationEvent.js";
import { Card, Details, Field, memberAuthor } from "../../ui/index.js";
import { excerpt } from "../../util/strings.js";
import { fakeMention } from "../../util/users.js";
import { dmModerationTarget, dmWarning, logModerationAction } from "./logs.js";
import {
	getReputationHistoryForUser,
	getUserReputation,
	grantReputation,
	REPUTATION_TIER_LABELS,
	REPUTATION_TIER_THRESHOLDS,
	ReputationTier,
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

const ViewSubcommand = subcommand({
	description: "View a user's reputation",
	options: {
		user: option.user({
			description: "The user to check",
			required: true,
		}),
	},
	async handle(interaction, { user }) {
		const member = interaction.member;
		if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "You don't have permission to view reputation.",
			});
		}

		const targetUser = user;

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

			const recentEvents = history
				.map((event) => {
					const sign = event.scoreChange >= 0 ? "+" : "";
					const label = REPUTATION_EVENT_LABELS[event.eventType];
					const time = `<t:${Math.floor(event.createdAt.getTime() / 1000)}:R>`;
					return `${sign}${event.scoreChange} - ${label} (${time})`;
				})
				.join("\n");

			return await interaction.reply(
				renderDiscordMessage(
					<Message isV2 flags={MessageFlags.Ephemeral}>
						<Card
							accent={reputation.tierColor}
							title={`Reputation: ${targetUser.username}`}
							author={memberAuthor(targetUser)}
							description={`${tierEmoji} **${reputation.tierLabel}**`}
							timestamp={Date.now()}
						>
							<Details
								items={[
									["Score", formatScore(reputation.score)],
									["Progress", progressToNextTier],
								]}
							/>
							{recentEvents && (
								<Field label="Recent Activity">{recentEvents}</Field>
							)}
						</Card>
					</Message>,
				),
			);
		} catch (error) {
			logger.error("Failed to fetch reputation:", error);
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "Failed to fetch reputation data.",
			});
		}
	},
});

const GrantSubcommand = subcommand({
	description: "Grant positive reputation to a user",
	options: {
		user: option.user({
			description: "The user to grant reputation to",
			required: true,
		}),
		type: option.string({
			description: "Type of reputation to grant",
			required: true,
			choices: grantableTypes,
		}),
		reason: option.string({
			description: "Reason for granting reputation",
			required: true,
		}),
		amount: option.integer({
			description: "Custom amount (only for Custom Amount type)",
			min_value: 1,
			max_value: 100,
		}),
	},
	async handle(interaction, { user, type, reason, amount: customAmount }) {
		const member = interaction.member;
		if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "You don't have permission to grant reputation.",
			});
		}

		const targetUser = user;
		const eventTypeStr = type;

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

			const dmSent = await dmModerationTarget(
				targetUser,
				`You were granted **+${result.event.scoreChange}** reputation in **${interaction.guild?.name ?? "the server"}**.\n**Reason:** ${reason}`,
			);

			await logModerationAction(interaction.client, {
				kind: "ReputationGranted",
				moderator: interaction.user,
				target: targetUser,
				eventType: REPUTATION_EVENT_LABELS[eventType],
				scoreChange: result.event.scoreChange,
				newScore: result.newScore,
				reason,
				dmSent,
			});

			const tierChange = result.tierChanged
				? `\nTier changed: **${REPUTATION_TIER_LABELS[result.newTier]}**`
				: "";

			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content:
					`Granted **+${result.event.scoreChange}** reputation to ${fakeMention(targetUser)}\n` +
					`**Reason:** ${reason}\n` +
					`**New Score:** ${formatScore(result.newScore)}${tierChange}` +
					dmWarning(dmSent),
			});
		} catch (error) {
			logger.error("Failed to grant reputation:", error);
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "Failed to grant reputation.",
			});
		}
	},
});

const HistorySubcommand = subcommand({
	description: "View a user's reputation history",
	options: {
		user: option.user({
			description: "The user to check",
			required: true,
		}),
		limit: option.integer({
			description: "Number of events to show (default: 20)",
			min_value: 5,
			max_value: 50,
		}),
	},
	async handle(interaction, { user, limit = 20 }) {
		const member = interaction.member;
		if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "You don't have permission to view reputation history.",
			});
		}

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const targetUser = user;

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

			const eventLines = history.map((event) => {
				const sign = event.scoreChange >= 0 ? "+" : "";
				const label = REPUTATION_EVENT_LABELS[event.eventType];
				const time = `<t:${Math.floor(event.createdAt.getTime() / 1000)}:f>`;
				const reason = event.reason ? ` - ${event.reason.slice(0, 50)}` : "";
				return `\`${sign}${event.scoreChange.toString().padStart(3)}\` ${label}${reason}\n  ${time}`;
			});

			return await interaction.editReply(
				renderDiscordMessage(
					<Message isV2>
						<Card
							accent={reputation.tierColor}
							title={`Reputation History: ${targetUser.username}`}
							author={memberAuthor(targetUser)}
							description={`**Current Score:** ${formatScore(reputation.score)} (${reputation.tierLabel})`}
							timestamp={Date.now()}
						>
							<Field label="Events">
								{excerpt(eventLines.join("\n"), { maxLength: 3000 })}
							</Field>
						</Card>
					</Message>,
				),
			);
		} catch (error) {
			logger.error("Failed to fetch reputation history:", error);
			return await interaction.editReply({
				content: "Failed to fetch reputation history.",
			});
		}
	},
});

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
	if (nextTier === undefined) {
		return "Max tier reached";
	}
	const nextThreshold = REPUTATION_TIER_THRESHOLDS[nextTier];
	const pointsNeeded = nextThreshold - score;

	return `${pointsNeeded} to ${REPUTATION_TIER_LABELS[nextTier]}`;
}

export const ReputationCommand = defineCommand({
	name: "reputation",
	description: "Manage user reputation (mods only)",
	default_member_permissions: PermissionFlagsBits.ModerateMembers,
	subcommands: {
		view: ViewSubcommand,
		grant: GrantSubcommand,
		history: HistorySubcommand,
	},
});
