import {
	ActionRowBuilder,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	type GuildMember,
	type Interaction,
	type Message,
	ModalBuilder,
	type ModalSubmitInteraction,
	type OmitPartialGroupDMChannel,
	type SendableChannels,
	TextInputBuilder,
	TextInputStyle,
} from "discord.js";
import { config } from "../../Config.js";
import {
	type Suggestion,
	SuggestionStatus,
} from "../../store/models/Suggestion.js";
import type { EventListener } from "../module.js";
import {
	createSuggestionEmbedFromEntity,
	createVotesEmbed,
	getSuggestionByMessageIdOrRecoverFromMessage,
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

const SUGGESTION_BUTTON_MAP: {
	[key: string]: SuggestionVoteType;
} = {
	"suggestion-no": -1,
	"suggestion-yes": 1,
};

async function respondToSuggestionInteraction(
	interaction: ButtonInteraction | ModalSubmitInteraction,
	suggestion: Suggestion,
	suggestionArchive: SendableChannels,
	initialMessage: OmitPartialGroupDMChannel<Message>,
	moderatorReason?: string,
) {
	if (!interaction.guild) {
		await interaction.followUp({
			content: "This can only be done in a guild!",
			flags: "Ephemeral",
		});
		return;
	}

	// Find the thread associated with the original message
	let threadUrl: string | undefined;
	if (initialMessage.hasThread) {
		const thread = initialMessage.thread;
		if (thread) {
			threadUrl = `https://discord.com/channels/${interaction.guild.id}/${thread.id}`;
		}
	}

	const embed = await createSuggestionEmbedFromEntity(
		interaction.client,
		suggestion,
		moderatorReason,
		threadUrl,
	);

	const newMessage = await suggestionArchive.send({
		embeds: [embed],
		components: [
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId(SUGGESTION_VIEW_VOTES_ID)
					.setStyle(ButtonStyle.Secondary)
					.setEmoji("👁")
					.setLabel("View Votes"),
			),
		],
	});
	if (initialMessage.deletable) await initialMessage.delete();
	suggestion.messageId = BigInt(newMessage.id);
	await suggestion.save();
}

export const SuggestionButtonListener: EventListener = {
	async interactionCreate(client, interaction: Interaction) {
		if (!interaction.member || !interaction.inGuild()) return;
		const member = interaction.member as GuildMember;

		// Handle button interactions
		if (interaction.isButton()) {
			if (
				interaction.customId === SUGGESTION_NO_ID ||
				interaction.customId === SUGGESTION_YES_ID
			) {
				if (!interaction.message.editable) {
					await interaction.reply({
						content: "This suggestion is no longer editable!",
						flags: ["Ephemeral"],
					});
					return;
				}

				await interaction.deferReply({ flags: ["Ephemeral"] });

				const votingValue = SUGGESTION_BUTTON_MAP[
					interaction.customId as keyof typeof SUGGESTION_BUTTON_MAP
				] as SuggestionVoteType;

				const suggestion = await getSuggestionByMessageIdOrRecoverFromMessage(
					interaction.message,
				);

				if (suggestion == null) {
					await interaction.followUp({
						content: "No Suggestion found for this message",
						flags: ["Ephemeral"],
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
					embeds: [await createSuggestionEmbedFromEntity(client, suggestion)],
				});

				let content = `You ${previousVoteValue && previousVoteValue === votingValue ? "already " : ""}voted ${votingValue === 1 ? "**Yes**" : "**No**"} on this suggestion`;
				if (previousVoteValue && previousVoteValue !== votingValue) {
					content = `You changed your vote from ${previousVoteValue === 1 ? "**Yes**" : "**No**"} to ${votingValue === 1 ? "**Yes**" : "**No**"} on this suggestion`;
				}
				await interaction.followUp({
					content: content,
					flags: ["Ephemeral"],
				});
			} else if (interaction.customId === SUGGESTION_VIEW_VOTES_ID) {
				await interaction.deferReply({ flags: ["Ephemeral"] });
				const suggestion = await getSuggestionByMessageIdOrRecoverFromMessage(
					interaction.message,
				);
				if (!suggestion) {
					await interaction.followUp({
						content: "No Suggestion found for this message",
						flags: ["Ephemeral"],
					});
					return;
				}
				const yesVotes =
					suggestion.votes?.filter((vote) => vote.vote === 1) || [];
				const noVotes =
					suggestion.votes?.filter((vote) => vote.vote === -1) || [];

				const embed = createVotesEmbed(member, yesVotes, noVotes);

				await interaction.followUp({
					embeds: [embed],
					flags: ["Ephemeral"],
				});
			} else if (interaction.customId === SUGGESTION_MANAGE_APPROVE_ID) {
				const modal = new ModalBuilder()
					.setCustomId(SUGGESTION_MANAGE_APPROVE_MODAL_ID)
					.setTitle("Approve Suggestion");

				const reasonInput = new TextInputBuilder()
					.setCustomId(SUGGESTION_REASON_INPUT_ID)
					.setLabel("Reason (Optional)")
					.setStyle(TextInputStyle.Paragraph)
					.setPlaceholder("Enter an optional reason for approval...")
					.setRequired(false)
					.setMaxLength(1024);

				const actionRow =
					new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);

				modal.addComponents(actionRow);

				await interaction.showModal(modal);
			} else if (interaction.customId === SUGGESTION_MANAGE_REJECT_ID) {
				const modal = new ModalBuilder()
					.setCustomId(SUGGESTION_MANAGE_REJECT_MODAL_ID)
					.setTitle("Reject Suggestion");

				const reasonInput = new TextInputBuilder()
					.setCustomId(SUGGESTION_REASON_INPUT_ID)
					.setLabel("Reason (Optional)")
					.setStyle(TextInputStyle.Paragraph)
					.setPlaceholder("Enter an optional reason for rejection...")
					.setRequired(false)
					.setMaxLength(1024);

				const actionRow =
					new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);

				modal.addComponents(actionRow);

				await interaction.showModal(modal);
			}
		}

		// Handle modal submissions
		if (interaction.isModalSubmit()) {
			if (interaction.customId === SUGGESTION_MANAGE_APPROVE_MODAL_ID) {
				await interaction.deferUpdate();

				const reason = interaction.fields.getTextInputValue(
					SUGGESTION_REASON_INPUT_ID,
				);
				const initialMessage = await interaction.message?.fetchReference();

				if (!initialMessage) {
					await interaction.followUp({
						content: "Could not find the original suggestion message!",
						flags: ["Ephemeral"],
					});
					return;
				}

				const suggestion =
					await getSuggestionByMessageIdOrRecoverFromMessage(initialMessage);
				if (!suggestion) {
					await interaction.followUp({
						content: "No Suggestion found for this message",
						flags: ["Ephemeral"],
					});
					return;
				}

				suggestion.status = SuggestionStatus.APPROVED;
				suggestion.moderatorId = BigInt(member.id);
				await suggestion.save();

				const suggestionArchive = await client.channels.fetch(
					config.suggest.archiveChannel,
				);
				if (suggestionArchive) {
					if (
						!suggestionArchive.isSendable() ||
						!suggestionArchive.isTextBased()
					) {
						await interaction.followUp({
							content:
								"The suggestion channel is either not writeable or not a text channel!",
							flags: ["Ephemeral"],
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
							content: "Suggestion approved!",
						});
					} catch (e) {
						console.error(e);
						await interaction.followUp({
							content:
								"Something went wrong while archiving the suggestion! Please try again later!",
							flags: ["Ephemeral"],
						});
					}
				}
			} else if (interaction.customId === SUGGESTION_MANAGE_REJECT_MODAL_ID) {
				await interaction.deferUpdate();

				const reason = interaction.fields.getTextInputValue(
					SUGGESTION_REASON_INPUT_ID,
				);
				const initialMessage = await interaction.message?.fetchReference();

				if (!initialMessage) {
					await interaction.followUp({
						content: "Could not find the original suggestion message!",
						flags: ["Ephemeral"],
					});
					return;
				}

				const suggestion =
					await getSuggestionByMessageIdOrRecoverFromMessage(initialMessage);
				if (!suggestion) {
					await interaction.followUp({
						content: "No Suggestion found for this message",
						flags: ["Ephemeral"],
					});
					return;
				}

				suggestion.status = SuggestionStatus.REJECTED;
				suggestion.moderatorId = BigInt(member.id);
				await suggestion.save();

				const suggestionArchive = await client.channels.fetch(
					config.suggest.archiveChannel,
				);
				if (suggestionArchive) {
					if (
						!suggestionArchive.isSendable() ||
						!suggestionArchive.isTextBased()
					) {
						await interaction.followUp({
							content:
								"The suggestion channel is either not writeable or not a text channel!",
							flags: ["Ephemeral"],
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
							content: "Suggestion rejected!",
						});
					} catch (e) {
						console.error(e);
						await interaction.followUp({
							content:
								"Something went wrong while archiving the suggestion! Please try again later!",
							flags: ["Ephemeral"],
						});
					}
				}
			}
		}
	},
};
