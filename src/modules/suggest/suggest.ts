import { Op } from "@sequelize/core";
import {
	ActionRowBuilder,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	type Client,
	type EmbedBuilder,
	type GuildMember,
	type Message,
	MessageFlags,
	ModalBuilder,
	type ModalSubmitInteraction,
	type OmitPartialGroupDMChannel,
	type SendableChannels,
	type TextBasedChannel,
	TextInputBuilder,
	TextInputStyle,
	type UserResolvable,
} from "discord.js";
import { config } from "../../Config.js";
import { logger } from "../../logging.js";
import { Suggestion, SuggestionStatus } from "../../store/models/Suggestion.js";
import { SuggestionVote } from "../../store/models/SuggestionVote.js";
import { createStandardEmbed, standardFooter } from "../../util/embeds.js";
import { actualMention, actualMentionById } from "../../util/users.js";

export const SUGGESTION_ID_FIELD_NAME = "Suggestion ID";

export const SUGGESTION_YES_ID = "suggestion-yes";
export const SUGGESTION_NO_ID = "suggestion-no";
export const SUGGESTION_MANAGE_APPROVE_ID = "suggestion-manage-approve";
export const SUGGESTION_MANAGE_REJECT_ID = "suggestion-manage-reject";

export const SUGGESTION_MANAGE_APPROVE_MODAL_ID =
	"suggestion-manage-approve-modal";
export const SUGGESTION_MANAGE_REJECT_MODAL_ID =
	"suggestion-manage-reject-modal";

export const SUGGESTION_REASON_INPUT_ID = "suggestion-reason-input";

export const SUGGESTION_VIEW_VOTES_ID = "suggestion-view-votes";

export type SuggestionVoteNo = -1;
export type SuggestionVoteYes = 1;
export type SuggestionVoteType = SuggestionVoteNo | SuggestionVoteYes;

export async function createSuggestionEmbed(
	id: string,
	client: Client,
	submitter: UserResolvable,
	suggestionText: string,
	status?: SuggestionStatus,
	moderatorId?: string,
	moderatorReason?: string,
	threadUrl?: string,
	upvotes: number = 0,
	downVotes: number = 0,
): Promise<EmbedBuilder> {
	const builder = createStandardEmbed(submitter ?? undefined);

	if (status) {
		builder.addFields({
			name: "Status",
			value: `**${status}**`,
		});
		builder.setColor(status === SuggestionStatus.REJECTED ? "Red" : "Green");
		if (moderatorId) {
			builder.addFields({
				name: `${status === SuggestionStatus.REJECTED ? "**Denied**" : "**Approved**"} By`,
				value: actualMentionById(BigInt(moderatorId)),
			});
		}
		if (moderatorReason) {
			builder.addFields({
				name: "Reason",
				value: moderatorReason,
			});
		}
		if (threadUrl) {
			builder.addFields({
				name: "Discussion Thread",
				value: `[View Discussion](${threadUrl})`,
				inline: true,
			});
		}
	}

	builder.addFields([
		{
			name: "Submitter",
			value: actualMention(submitter),
			inline: true,
		},
		{
			name: "Suggestion",
			value: suggestionText,
		},
		{
			name: status === SuggestionStatus.PENDING ? "Current Votes" : "Results",
			value: `:white_check_mark:: **${upvotes}**
        :x:: **${downVotes}**
            `,
		},
	]);

	builder.setFooter({
		...standardFooter(),
		text: `${SUGGESTION_ID_FIELD_NAME}: ${id}`,
	});

	const avatarURL = (await client.users.fetch(submitter)).avatarURL();
	if (avatarURL) {
		builder.setThumbnail(avatarURL);
	}
	return builder;
}

export const createSuggestionEmbedFromEntity: (
	client: Client,
	suggestion: Suggestion,
	moderatorReason?: string,
	threadUrl?: string,
) => Promise<EmbedBuilder> = async (
	client,
	suggestion: Suggestion,
	moderatorReason,
	threadUrl,
) => {
	const upvotes = suggestion.votes?.filter((vote) => vote.vote === 1).length;
	const downvotes = suggestion.votes?.filter((vote) => vote.vote === -1).length;

	const member = await client.users
		.fetch(suggestion.memberId.toString())
		.catch(() => suggestion.memberId.toString());
	return createSuggestionEmbed(
		suggestion.id.toString(),
		client,
		member,
		suggestion.suggestionText,

		suggestion.status !== SuggestionStatus.PENDING
			? suggestion.status
			: undefined,
		suggestion.moderatorId ? suggestion.moderatorId.toString() : undefined,
		moderatorReason,
		threadUrl,
		upvotes ?? 0,
		downvotes ?? 0,
	);
};

export const getSuggestionByMessageId: (
	messageId: bigint,
) => Promise<Suggestion | null> = async (messageId: bigint) => {
	return await Suggestion.findOne({
		where: {
			messageId: messageId,
		},
		include: [SuggestionVote],
	});
};

async function getSuggestionChannels(
	client: Client,
): Promise<TextBasedChannel[]> {
	const channels = await Promise.all(
		[config.suggest.suggestionsChannel, config.suggest.archiveChannel].map(
			async (channelId) => {
				try {
					const channel = await client.channels.fetch(channelId);
					if (!channel?.isTextBased()) {
						return null;
					}
					return channel;
				} catch (error) {
					logger.error(
						"Failed to fetch suggestion channel %s",
						channelId,
						error,
					);
					return null;
				}
			},
		),
	);

	return channels.filter(
		(channel): channel is TextBasedChannel => channel !== null,
	);
}

async function getSuggestionMessage(
	channels: TextBasedChannel[],
	messageId: bigint,
): Promise<Message | null> {
	for (const channel of channels) {
		try {
			return await channel.messages.fetch(messageId.toString());
		} catch {
			// Try the next suggestion channel.
		}
	}

	return null;
}

export async function refreshSuggestionMessage(
	client: Client,
	suggestion: Suggestion,
	suggestionChannels?: TextBasedChannel[],
): Promise<boolean> {
	const channels = suggestionChannels ?? (await getSuggestionChannels(client));
	const message = await getSuggestionMessage(channels, suggestion.messageId);

	if (!message) {
		logger.warn(
			"Could not find suggestion message %s for suggestion %s",
			suggestion.messageId,
			suggestion.id,
		);
		return false;
	}

	if (!message.editable) {
		logger.warn(
			"Suggestion message %s for suggestion %s is not editable",
			suggestion.messageId,
			suggestion.id,
		);
		return false;
	}

	await message.edit({
		embeds: [await createSuggestionEmbedFromEntity(client, suggestion)],
	});
	return true;
}

export interface RemovedSuggestionVotesResult {
	removedVotes: number;
	updatedSuggestions: number;
}

export interface RemovedSuggestionVotesForMembersResult
	extends RemovedSuggestionVotesResult {
	affectedMembers: number;
}

export async function removeSuggestionVotesForMembers(
	client: Client,
	memberIds: Iterable<bigint>,
): Promise<RemovedSuggestionVotesForMembersResult> {
	const uniqueMemberIds = Array.from(
		new Set(Array.from(memberIds, (memberId) => memberId.toString())),
	).map((memberId) => BigInt(memberId));

	if (uniqueMemberIds.length === 0) {
		return {
			removedVotes: 0,
			updatedSuggestions: 0,
			affectedMembers: 0,
		};
	}

	const votes = await SuggestionVote.findAll({
		where: {
			memberId: {
				[Op.in]: uniqueMemberIds,
			},
		},
	});

	if (votes.length === 0) {
		return {
			removedVotes: 0,
			updatedSuggestions: 0,
			affectedMembers: 0,
		};
	}

	const affectedMemberIds = new Set(
		votes.map((vote) => vote.memberId.toString()),
	);
	const suggestionIds = Array.from(
		new Set(votes.map((vote) => vote.suggestionId.toString())),
	).map((suggestionId) => BigInt(suggestionId));

	await SuggestionVote.destroy({
		where: {
			memberId: {
				[Op.in]: uniqueMemberIds,
			},
		},
	});

	const suggestionChannels = await getSuggestionChannels(client);
	let updatedSuggestions = 0;

	for (const suggestionId of suggestionIds) {
		const suggestion = await Suggestion.findOne({
			where: {
				id: suggestionId,
			},
			include: [SuggestionVote],
		});

		if (!suggestion) {
			continue;
		}

		try {
			if (
				await refreshSuggestionMessage(client, suggestion, suggestionChannels)
			) {
				updatedSuggestions++;
			}
		} catch (error) {
			logger.error(
				"Failed to refresh suggestion %s after removing votes from banned users",
				suggestionId,
				error,
			);
		}
	}

	return {
		removedVotes: votes.length,
		updatedSuggestions,
		affectedMembers: affectedMemberIds.size,
	};
}

export async function removeSuggestionVotesForMember(
	client: Client,
	memberId: bigint,
): Promise<RemovedSuggestionVotesResult> {
	const { removedVotes, updatedSuggestions } =
		await removeSuggestionVotesForMembers(client, [memberId]);
	return {
		removedVotes,
		updatedSuggestions,
	};
}

export async function getSuggestionByMessageIdOrRecoverFromMessage(
	embedMessage: Message,
): Promise<Suggestion | null> {
	const fromMessage = await getSuggestionByMessageId(BigInt(embedMessage.id));
	if (fromMessage) {
		return fromMessage;
	}

	logger.warn(
		"No suggestion found for message %s, trying to recover from message",
		embedMessage.id,
	);
	// try to recover from message
	if (embedMessage.embeds.length === 0) {
		return null;
	}

	const embed = embedMessage.embeds[0];
	const idField = embed.footer?.text;
	if (!idField) {
		return null;
	}
	const id = idField.match(/Suggestion ID: (\d+)/)?.[1];
	if (!id) {
		return null;
	}

	const submitter = embed.fields?.find((f) => f.name === "Submitter");
	if (!submitter) {
		return null;
	}
	const submitterId = submitter.value.match(/<@!?(\d+)>/)?.[1];
	if (!submitterId) {
		return null;
	}
	const suggestionField = embed.fields?.find((f) => f.name === "Suggestion");
	if (!suggestionField) {
		return null;
	}

	// we can't recover votes from message as we don't know who voted, so just create the suggestion

	logger.warn("Recovered suggestion %s from message %s", id, embedMessage.id);
	const suggestion = await Suggestion.create({
		id: BigInt(id),
		memberId: BigInt(submitterId),
		suggestionText: suggestionField.value,
		messageId: BigInt(embedMessage.id),
		status: SuggestionStatus.PENDING,
	});

	if (embedMessage.editable) {
		const updatedEmbed = await createSuggestionEmbedFromEntity(
			embedMessage.client,
			suggestion,
		);
		await embedMessage.edit({ embeds: [updatedEmbed] });
	}

	return suggestion;
}

export const createSuggestion: (
	id: bigint,
	userId: bigint,
	messageId: bigint,
	suggestionText: string,
) => Promise<Suggestion> = async (
	id: bigint,
	userId: bigint,
	messageId: bigint,
	suggestionText: string,
) => {
	return await Suggestion.create({
		id: id,
		memberId: userId,
		suggestionText: suggestionText,
		messageId: messageId,
		status: SuggestionStatus.PENDING,
	});
};

export const getVoteForMemberAndSuggestion: (
	suggestionId: bigint,
	memberId: bigint,
) => Promise<SuggestionVote | null> = async (
	suggestionId: bigint,
	memberId: bigint,
) => {
	return await SuggestionVote.findOne({
		where: {
			suggestionId: suggestionId,
			memberId: memberId,
		},
	});
};

export const upsertOrRemoveVote: (
	suggestionId: bigint,
	memberId: bigint,
	vote: SuggestionVoteType,
) => Promise<SuggestionVoteType | undefined | null> = async (
	suggestionId,
	memberId,
	vote,
) => {
	// insert or update vote
	const existingVote = await getVoteForMemberAndSuggestion(
		suggestionId,
		memberId,
	);
	if (existingVote) {
		const previousVote = existingVote.vote;
		if (existingVote.vote === vote) {
			await existingVote.destroy();
			return null;
		}

		existingVote.vote = vote;
		await existingVote.save();
		return previousVote as SuggestionVoteType;
	} else {
		await createVote(suggestionId, memberId, vote);
		return undefined;
	}
};

export const createVote: (
	suggestionId: bigint,
	memberId: bigint,
	vote: SuggestionVoteType,
) => Promise<SuggestionVote> = async (
	suggestionId: bigint,
	memberId: bigint,
	vote: SuggestionVoteType,
) => {
	return await SuggestionVote.create({
		suggestionId: suggestionId,
		memberId: memberId,
		vote: vote,
	});
};

export const createVotesEmbed: (
	member: GuildMember,
	upvotes: SuggestionVote[],
	downvotes: SuggestionVote[],
) => EmbedBuilder = (member, upvotes, downvotes) => {
	const mentionVoter = (vote: SuggestionVote) =>
		vote.memberId ? actualMentionById(vote.memberId) : "Unknown Voter";
	return createStandardEmbed(member)
		.setTitle("Suggestion Votes")
		.addFields([
			{
				name: `${config.suggest.yesEmojiId} Upvotes`,
				value: upvotes.map(mentionVoter).join("\n"),
				inline: true,
			},
			{
				name: `${config.suggest.noEmojiId} Downvotes`,
				value: downvotes.map(mentionVoter).join("\n"),
				inline: true,
			},
		]);
};

export const createSuggestionManageButtons: () => ActionRowBuilder<ButtonBuilder> =
	() => {
		return new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setStyle(ButtonStyle.Success)
				.setCustomId(SUGGESTION_MANAGE_APPROVE_ID)
				.setEmoji("✅")
				.setLabel("Approve"),
			new ButtonBuilder()
				.setStyle(ButtonStyle.Danger)
				.setCustomId(SUGGESTION_MANAGE_REJECT_ID)
				.setEmoji("❌")
				.setLabel("Reject/Close"),
		);
	};

export function generateVoteMessage(
	votingValue: SuggestionVoteType,
	previousVoteValue?: SuggestionVoteType | null,
): string {
	const voteText = votingValue === 1 ? "**Yes**" : "**No**";

	if (previousVoteValue === null) {
		return `You removed your ${voteText} vote from this suggestion.`;
	}

	if (previousVoteValue === undefined) {
		return `You voted ${voteText} on this suggestion.`;
	}

	if (previousVoteValue === votingValue) {
		return `You already voted ${voteText} on this suggestion.`;
	}

	const previousVoteText = previousVoteValue === 1 ? "**Yes**" : "**No**";
	return `You changed your vote from ${previousVoteText} to ${voteText} on this suggestion.`;
}

export function createReasonModal(
	customId: string,
	title: string,
	placeholder: string,
): ModalBuilder {
	const reasonInput = new TextInputBuilder()
		.setCustomId(SUGGESTION_REASON_INPUT_ID)
		.setLabel("Reason (Optional)")
		.setStyle(TextInputStyle.Paragraph)
		.setPlaceholder(placeholder)
		.setRequired(false)
		.setMaxLength(1024);

	const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
		reasonInput,
	);

	return new ModalBuilder()
		.setCustomId(customId)
		.setTitle(title)
		.addComponents(actionRow);
}

export async function respondToSuggestionInteraction(
	interaction: ButtonInteraction | ModalSubmitInteraction,
	suggestion: Suggestion,
	suggestionArchive: SendableChannels,
	initialMessage: OmitPartialGroupDMChannel<Message>,
	moderatorReason?: string,
): Promise<void> {
	if (!interaction.guild) {
		await interaction.followUp({
			content: "This can only be done in a guild!",
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	const threadUrl = initialMessage.thread?.url;
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

	if (initialMessage.deletable) {
		await initialMessage.delete();
	}

	suggestion.messageId = BigInt(newMessage.id);
	await suggestion.save();
}
