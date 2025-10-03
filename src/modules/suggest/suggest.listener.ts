import {
	type ButtonInteraction,
	ButtonStyle,
	type GuildMember,
	type Interaction,
	type ModalSubmitInteraction,
	TextInputStyle,
} from "discord.js";
import { config } from "../../Config.js";
import { SuggestionStatus } from "../../store/models/Suggestion.js";
import { EPHEMERAL_FLAG } from "../../util/message.js";
import type { EventListener } from "../module.js";
import {
	createReasonModal,
	createSuggestionEmbedFromEntity,
	createVotesEmbed,
	generateVoteMessage,
	getSuggestionByMessageIdOrRecoverFromMessage,
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
	upsertVote,
} from "./suggest.js";

const SUGGESTION_BUTTON_MAP: Record<string, SuggestionVoteType> = {
	[SUGGESTION_NO_ID]: -1,
	[SUGGESTION_YES_ID]: 1,
};

// Handler functions
async function handleVoteButtonInteraction(
	interaction: ButtonInteraction,
	member: GuildMember,
): Promise<void> {
	if (!interaction.message.editable) {
		await interaction.reply({
			content: "This suggestion is no longer editable!",
			flags: EPHEMERAL_FLAG,
		});
		return;
	}

	await interaction.deferReply({ flags: EPHEMERAL_FLAG });

	const votingValue = SUGGESTION_BUTTON_MAP[interaction.customId];
	const suggestion = await getSuggestionByMessageIdOrRecoverFromMessage(
		interaction.message,
	);

	if (!suggestion) {
		await interaction.followUp({
			content: "No Suggestion found for this message",
			flags: EPHEMERAL_FLAG,
		});
		return;
	}

	const previousVoteValue = await upsertVote(
		suggestion.id,
		BigInt(member.id),
		votingValue,
	);

	await suggestion.reload();
	await interaction.message.edit({
		embeds: [
			await createSuggestionEmbedFromEntity(interaction.client, suggestion),
		],
	});

	const content = generateVoteMessage(votingValue, previousVoteValue);
	await interaction.followUp({
		content,
		flags: EPHEMERAL_FLAG,
	});
}

async function handleViewVotesInteraction(
	interaction: ButtonInteraction,
	member: GuildMember,
): Promise<void> {
	await interaction.deferReply({ flags: EPHEMERAL_FLAG });

	const suggestion = await getSuggestionByMessageIdOrRecoverFromMessage(
		interaction.message,
	);
	if (!suggestion) {
		await interaction.followUp({
			content: "No Suggestion found for this message",
			flags: EPHEMERAL_FLAG,
		});
		return;
	}

	const yesVotes = suggestion.votes?.filter((vote) => vote.vote === 1) || [];
	const noVotes = suggestion.votes?.filter((vote) => vote.vote === -1) || [];
	const embed = createVotesEmbed(member, yesVotes, noVotes);

	await interaction.followUp({
		embeds: [embed],
		flags: EPHEMERAL_FLAG,
	});
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
			flags: EPHEMERAL_FLAG,
		});
		return;
	}

	const suggestion =
		await getSuggestionByMessageIdOrRecoverFromMessage(initialMessage);
	if (!suggestion) {
		await interaction.followUp({
			content: "No Suggestion found for this message",
			flags: EPHEMERAL_FLAG,
		});
		return;
	}

	suggestion.status = status;
	suggestion.moderatorId = BigInt(member.id);
	await suggestion.save();

	const suggestionArchive = await interaction.client.channels.fetch(
		config.suggest.archiveChannel,
	);

	if (!suggestionArchive) {
		await interaction.followUp({
			content: "Could not find the suggestion archive channel!",
			flags: EPHEMERAL_FLAG,
		});
		return;
	}

	if (!suggestionArchive.isSendable() || !suggestionArchive.isTextBased()) {
		await interaction.followUp({
			content:
				"The suggestion channel is either not writeable or not a text channel!",
			flags: EPHEMERAL_FLAG,
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
		console.error(error);
		await interaction.followUp({
			content:
				"Something went wrong while archiving the suggestion! Please try again later!",
			flags: EPHEMERAL_FLAG,
		});
	}
}

export const SuggestionButtonListener: EventListener = {
	async interactionCreate(_client, interaction: Interaction) {
		if (!interaction.member || !interaction.inGuild()) return;
		const member = interaction.member as GuildMember;

		if (interaction.isButton()) {
			switch (interaction.customId) {
				case SUGGESTION_NO_ID:
				case SUGGESTION_YES_ID:
					await handleVoteButtonInteraction(interaction, member);
					break;

				case SUGGESTION_VIEW_VOTES_ID:
					await handleViewVotesInteraction(interaction, member);
					break;

				case SUGGESTION_MANAGE_APPROVE_ID: {
					const modal = createReasonModal(
						SUGGESTION_MANAGE_APPROVE_MODAL_ID,
						"Approve Suggestion",
						"Enter an optional reason for approval...",
					);
					await interaction.showModal(modal);
					break;
				}

				case SUGGESTION_MANAGE_REJECT_ID: {
					const modal = createReasonModal(
						SUGGESTION_MANAGE_REJECT_MODAL_ID,
						"Reject Suggestion",
						"Enter an optional reason for rejection...",
					);
					await interaction.showModal(modal);
					break;
				}
			}
		}

		if (interaction.isModalSubmit()) {
			switch (interaction.customId) {
				case SUGGESTION_MANAGE_APPROVE_MODAL_ID:
					await handleManageModalSubmission(
						interaction,
						member,
						SuggestionStatus.APPROVED,
						"Suggestion approved!",
					);
					break;

				case SUGGESTION_MANAGE_REJECT_MODAL_ID:
					await handleManageModalSubmission(
						interaction,
						member,
						SuggestionStatus.REJECTED,
						"Suggestion rejected!",
					);
					break;
			}
		}
	},
};
