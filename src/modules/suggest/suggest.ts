import { Op } from "@sequelize/core";
import {
	ActionRowBuilder,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	type Client,
	type Message,
	MessageFlags,
	ModalBuilder,
	type ModalSubmitInteraction,
	type OmitPartialGroupDMChannel,
	type SendableChannels,
	type TextBasedChannel,
	TextInputBuilder,
	TextInputStyle,
} from "discord.js";
import { config } from "../../Config.js";
import { logger } from "../../logging.js";
import { Suggestion, SuggestionStatus } from "../../store/models/Suggestion.js";
import { SuggestionVote } from "../../store/models/SuggestionVote.js";
import { awaitTimeout } from "../../util/timeouts.js";

import {
	SUGGESTION_MANAGE_APPROVE_ID,
	SUGGESTION_MANAGE_REJECT_ID,
	SUGGESTION_REASON_INPUT_ID,
} from "./suggest.constants.js";

export * from "./suggest.constants.js";

import {
	renderSuggestion,
	suggestionEdit,
	suggestionView,
} from "./suggest.post.js";

export type SuggestionVoteNo = -1;
export type SuggestionVoteYes = 1;
export type SuggestionVoteType = SuggestionVoteNo | SuggestionVoteYes;

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

	await recoverDecisionFromEmbed(message, suggestion);
	await message.edit(
		suggestionEdit(await renderSuggestion(client, suggestionView(suggestion))),
	);
	return true;
}

/**
 * Suggestions decided before the reason and thread link were stored only have them in their message's embed.
 * Saves them from there, so re-rendering the message (which replaces the embed) doesn't lose them.
 */
async function recoverDecisionFromEmbed(
	message: Message,
	suggestion: Suggestion,
) {
	const fields = message.embeds?.[0]?.fields;
	if (!fields) return;
	const reason = fields.find((field) => field.name === "Reason")?.value;
	const threadUrl = fields
		.find((field) => field.name === "Discussion Thread")
		?.value.match(/\((https?:\/\/[^)\s]+)\)/)?.[1];
	if (!suggestion.reason && reason) suggestion.reason = reason;
	if (!suggestion.threadUrl && threadUrl) suggestion.threadUrl = threadUrl;
	if (suggestion.changed()) await suggestion.save();
}

/** Re-renders every suggestion's message from its row, so UI changes reach old suggestions. */
export async function refreshSuggestions(client: Client) {
	try {
		const channels = await getSuggestionChannels(client);
		const suggestions = await Suggestion.findAll({ include: [SuggestionVote] });
		for (const suggestion of suggestions) {
			try {
				await refreshSuggestionMessage(client, suggestion, channels);
			} catch (error) {
				logger.error("Failed to refresh suggestion %s", suggestion.id, error);
			}
			// spreads the edits out
			await awaitTimeout(1000);
		}
		logger.info(`Refreshed ${suggestions.length} suggestions`);
	} catch (error) {
		logger.error("Failed to refresh suggestions", error);
	}
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
	const [embed] = embedMessage.embeds;
	if (!embed) {
		return null;
	}

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
		await embedMessage.edit(
			suggestionEdit(
				await renderSuggestion(embedMessage.client, suggestionView(suggestion)),
			),
		);
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
	suggestion.reason = moderatorReason ?? null;
	suggestion.threadUrl = threadUrl ?? null;
	await suggestion.save();

	const newMessage = await suggestionArchive.send({
		...(await renderSuggestion(interaction.client, suggestionView(suggestion))),
		allowedMentions: { parse: [] },
	});

	if (initialMessage.deletable) {
		await initialMessage.delete();
	}

	suggestion.messageId = BigInt(newMessage.id);
	await suggestion.save();
}
