import {
	type ButtonInteraction,
	type GuildMember,
	MessageFlags,
	type ModalSubmitInteraction,
} from "discord.js";
import { config } from "../../Config.js";
import { defineComponent } from "../../components/index.js";
import { logger } from "../../logging.js";
import { getOrCreateUserById } from "../../store/models/DDUser.js";
import { Suggestion, SuggestionStatus } from "../../store/models/Suggestion.js";
import { notifyMultipleAchievements } from "../achievements/achievementNotifier.js";
import { checkAndAwardAchievements } from "../achievements/achievementService.js";

import type { EventListener } from "../module.js";
import {
	createReasonModal,
	generateVoteMessage,
	getSuggestionByMessageIdOrRecoverFromMessage,
	removeSuggestionVotesForMember,
	respondToSuggestionInteraction,
	SUGGESTION_MANAGE_APPROVE_ID,
	SUGGESTION_MANAGE_APPROVE_MODAL_ID,
	SUGGESTION_MANAGE_REJECT_ID,
	SUGGESTION_MANAGE_REJECT_MODAL_ID,
	SUGGESTION_NO_ID,
	SUGGESTION_REASON_INPUT_ID,
	SUGGESTION_VIEW_VOTES_ID,
	SUGGESTION_YES_ID,
	type SuggestionVoteType,
	upsertOrRemoveVote,
} from "./suggest.js";
import {
	renderSuggestion,
	renderVotes,
	suggestionEdit,
	suggestionView,
} from "./suggest.post.js";

// Handler functions
async function handleVoteButtonInteraction(
	interaction: ButtonInteraction,
	member: GuildMember,
	votingValue: SuggestionVoteType,
): Promise<void> {
	if (!interaction.message.editable) {
		await interaction.reply({
			content: "This suggestion is no longer editable!",
			flags: MessageFlags.Ephemeral,
		});
		return;
	}
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const suggestion = await getSuggestionByMessageIdOrRecoverFromMessage(
		interaction.message,
	);

	if (!suggestion) {
		await interaction.followUp({
			content: "No Suggestion found for this message",
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	const previousVoteValue = await upsertOrRemoveVote(
		suggestion.id,
		BigInt(member.id),
		votingValue,
	);

	await suggestion.reload();
	await interaction.message.edit(
		suggestionEdit(
			await renderSuggestion(interaction.client, suggestionView(suggestion)),
		),
	);

	const content = generateVoteMessage(votingValue, previousVoteValue);
	await interaction.followUp({
		content,
		flags: MessageFlags.Ephemeral,
	});
}

async function handleViewVotesInteraction(
	interaction: ButtonInteraction,
	member: GuildMember,
): Promise<void> {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const suggestion = await getSuggestionByMessageIdOrRecoverFromMessage(
		interaction.message,
	);
	if (!suggestion) {
		await interaction.followUp({
			content: "No Suggestion found for this message",
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	const yesVotes = suggestion.votes?.filter((vote) => vote.vote === 1) || [];
	const noVotes = suggestion.votes?.filter((vote) => vote.vote === -1) || [];

	await interaction.followUp(renderVotes(member, yesVotes, noVotes));
}

async function handleManageModalSubmission(
	interaction: ModalSubmitInteraction,
	member: GuildMember,
	status: SuggestionStatus,
	successMessage: string,
): Promise<void> {
	await interaction.deferUpdate();

	const reason = interaction.fields.getTextInputValue(
		SUGGESTION_REASON_INPUT_ID,
	);
	const initialMessage = await interaction.message?.fetchReference();

	if (!initialMessage) {
		await interaction.followUp({
			content: "Could not find the original suggestion message!",
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	const suggestion =
		await getSuggestionByMessageIdOrRecoverFromMessage(initialMessage);
	if (!suggestion) {
		await interaction.followUp({
			content: "No Suggestion found for this message",
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	suggestion.status = status;
	suggestion.moderatorId = BigInt(member.id);
	await suggestion.save();

	if (status === SuggestionStatus.APPROVED) {
		try {
			const suggestionAuthorId = suggestion.memberId;
			const ddUser = await getOrCreateUserById(suggestionAuthorId);
			const suggestionsApproved = await Suggestion.count({
				where: {
					memberId: suggestionAuthorId,
					status: SuggestionStatus.APPROVED,
				},
			});
			const newAchievements = await checkAndAwardAchievements(
				ddUser,
				{ type: "suggestion", event: "suggestion_approved" },
				{ suggestionsApproved },
			);

			if (newAchievements.length > 0) {
				const suggestionMember = await interaction.guild?.members.fetch(
					suggestionAuthorId.toString(),
				);
				if (suggestionMember) {
					await notifyMultipleAchievements(
						interaction.client,
						suggestionMember,
						newAchievements.map((a) => a.definition),
						interaction.channel ?? undefined,
					);
				}
			}
		} catch (error) {
			logger.error("Failed to check suggestion approval achievements", error);
		}
	}

	const suggestionArchive = await interaction.client.channels.fetch(
		config.suggest.archiveChannel,
	);

	if (!suggestionArchive) {
		await interaction.followUp({
			content: "Could not find the suggestion archive channel!",
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	if (!suggestionArchive.isSendable() || !suggestionArchive.isTextBased()) {
		await interaction.followUp({
			content:
				"The suggestion channel is either not writeable or not a text channel!",
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	try {
		await respondToSuggestionInteraction(
			interaction,
			suggestion,
			suggestionArchive,
			initialMessage,
			reason.trim() || undefined,
		);
		await interaction.editReply({
			content: successMessage,
		});
	} catch (error) {
		logger.error(error);
		await interaction.followUp({
			content:
				"Something went wrong while archiving the suggestion! Please try again later!",
			flags: MessageFlags.Ephemeral,
		});
	}
}

/** Suggestions only work inside the guild, so anything else is ignored */
const inGuild =
	<I extends ButtonInteraction | ModalSubmitInteraction>(
		handle: (interaction: I, member: GuildMember) => Promise<void>,
	) =>
	async (interaction: I) => {
		if (interaction.inCachedGuild())
			await handle(interaction, interaction.member);
	};

// these ids predate the component router and must not change, as old suggestion messages still use them
export const SuggestionComponents = [
	defineComponent({
		id: SUGGESTION_YES_ID,
		kind: "button",
		handle: inGuild((interaction, member) =>
			handleVoteButtonInteraction(interaction, member, 1),
		),
	}),
	defineComponent({
		id: SUGGESTION_NO_ID,
		kind: "button",
		handle: inGuild((interaction, member) =>
			handleVoteButtonInteraction(interaction, member, -1),
		),
	}),
	defineComponent({
		id: SUGGESTION_VIEW_VOTES_ID,
		kind: "button",
		handle: inGuild(handleViewVotesInteraction),
	}),
	defineComponent({
		id: SUGGESTION_MANAGE_APPROVE_ID,
		kind: "button",
		async handle(interaction) {
			await interaction.showModal(
				createReasonModal(
					SUGGESTION_MANAGE_APPROVE_MODAL_ID,
					"Approve Suggestion",
					"Enter an optional reason for approval...",
				),
			);
		},
	}),
	defineComponent({
		id: SUGGESTION_MANAGE_REJECT_ID,
		kind: "button",
		async handle(interaction) {
			await interaction.showModal(
				createReasonModal(
					SUGGESTION_MANAGE_REJECT_MODAL_ID,
					"Reject Suggestion",
					"Enter an optional reason for rejection...",
				),
			);
		},
	}),
	defineComponent({
		id: SUGGESTION_MANAGE_APPROVE_MODAL_ID,
		kind: "modal",
		handle: inGuild((interaction, member) =>
			handleManageModalSubmission(
				interaction,
				member,
				SuggestionStatus.APPROVED,
				"Suggestion approved!",
			),
		),
	}),
	defineComponent({
		id: SUGGESTION_MANAGE_REJECT_MODAL_ID,
		kind: "modal",
		handle: inGuild((interaction, member) =>
			handleManageModalSubmission(
				interaction,
				member,
				SuggestionStatus.REJECTED,
				"Suggestion rejected!",
			),
		),
	}),
];

export const SuggestionButtonListener: EventListener = {
	async guildBanAdd(client, ban) {
		try {
			const { removedVotes, updatedSuggestions } =
				await removeSuggestionVotesForMember(client, BigInt(ban.user.id));

			if (removedVotes > 0) {
				logger.info(
					"Removed %d suggestion votes from banned user %s and refreshed %d suggestion messages",
					removedVotes,
					ban.user.id,
					updatedSuggestions,
				);
			}
		} catch (error) {
			logger.error(
				"Failed to remove suggestion votes for banned user %s",
				ban.user.id,
				error,
			);
		}
	},
};
