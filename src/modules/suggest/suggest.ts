import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	type EmbedBuilder,
	type GuildMember,
} from "discord.js";
import { config } from "../../Config.js";
import { Suggestion, SuggestionStatus } from "../../store/models/Suggestion.js";
import { SuggestionVote } from "../../store/models/SuggestionVote.js";
import { createStandardEmbed, standardFooter } from "../../util/embeds.js";
import { actualMention, actualMentionById } from "../../util/users.js";

export const SUGGESTION_ID_FIELD_NAME = "Suggestion ID";

export const SUGGESTION_YES_ID = "suggestion-yes";
export const SUGGESTION_NO_ID = "suggestion-no";
export const SUGGESTION_MANAGE_ID = "suggestion-manage";

export const SUGGESTION_MANAGE_APPROVE_ID = "suggestion-manage-approve";
export const SUGGESTION_MANAGE_REJECT_ID = "suggestion-manage-reject";

export const SUGGESTION_VIEW_VOTES_ID = "suggestion-view-votes";

export type SuggestionVoteType = 1 | -1;

export const createSuggestionEmbed: (
	id: string,
	member: GuildMember,
	suggestionText: string,
	upVotes?: number,
	downVotes?: number,
	status?: SuggestionStatus,
	moderatorId?: string,
) => Promise<EmbedBuilder> = async (
	id: string,
	member,
	suggestionText,
	upvotes = 0,
	downVotes = 0,
	status,
	moderatorId,
) => {
	const builder = createStandardEmbed(member);

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
	}

	builder.addFields([
		{
			name: "Submitter",
			value: actualMention(member),
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

	builder.setThumbnail((await member.fetch()).user.avatarURL());
	return builder;
};

export const createSuggestionEmbedFromEntity: (
	suggestion: Suggestion,
	member: GuildMember,
) => Promise<EmbedBuilder> = async (suggestion: Suggestion, member) => {
	const upvotes = suggestion.votes?.filter((vote) => vote.vote === 1).length;
	const downvotes = suggestion.votes?.filter((vote) => vote.vote === -1).length;

	return createSuggestionEmbed(
		suggestion.id.toString(),
		member,
		suggestion.suggestionText,
		upvotes ?? 0,
		downvotes ?? 0,
		suggestion.status !== SuggestionStatus.PENDING
			? suggestion.status
			: undefined,
		suggestion.moderatorId ? suggestion.moderatorId.toString() : undefined,
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

export const upsertVote: (
	suggestionId: bigint,
	memberId: bigint,
	vote: SuggestionVoteType,
) => Promise<SuggestionVoteType | undefined> = async (
	suggestionId: bigint,
	memberId: bigint,
	vote: SuggestionVoteType,
) => {
	// insert or update vote
	const existingVote = await getVoteForMemberAndSuggestion(
		suggestionId,
		memberId,
	);
	if (existingVote) {
		const previousVote = existingVote.vote;
		if (existingVote.vote === vote) {
			return previousVote as SuggestionVoteType;
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
	return createStandardEmbed(member)
		.setTitle("Suggestion Votes")
		.addFields([
			{
				name: `${config.suggest.yesEmojiId} Upvotes`,
				value: upvotes
					.map((vote) => actualMentionById(vote.memberId))
					.join("\n"),
				inline: true,
			},
			{
				name: `${config.suggest.noEmojiId} Downvotes`,
				value: downvotes
					.map((vote) => actualMentionById(vote.memberId))
					.join("\n"),
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
