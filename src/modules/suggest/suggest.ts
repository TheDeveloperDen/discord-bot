import { EmbedBuilder, GuildMember } from "discord.js";
import { createStandardEmbed } from "../../util/embeds.js";
import { actualMention } from "../../util/users.js";
import { Suggestion } from "../../store/models/Suggestion.js";
import { SuggestionVote } from "../../store/models/SuggestionVote.js";

export const SUGGESTION_ID_FIELD_NAME = "Suggestion ID";

export const SUGGESTION_YES_ID = "suggestion-yes";
export const SUGGESTION_NO_ID = "suggestion-no";

export type SuggestionVoteType = 1 | -1;

export const createSuggestionEmbed: (
  id: string,
  member: GuildMember,
  suggestionText: string,
  suggestionImage?: string,
  upVotes?: number,
  downVotes?: number,
) => EmbedBuilder = (
  id: string,
  member,
  suggestionText,
  suggestionImage,
  upvotes = 0,
  downVotes = 0,
) => {
  const builder = createStandardEmbed(member).addFields([
    {
      name: "Submitter",
      value: actualMention(member),
      inline: true,
    },
    {
      name: SUGGESTION_ID_FIELD_NAME,
      value: id,
    },
    {
      name: "Suggestion",
      value: suggestionText,
    },
    {
      name: "Current Votes",
      value: `-------------
        :white_check_mark::\`${upvotes}\`
        :x::\`${downVotes}\`
      `,
    },
  ]);

  if (suggestionImage) {
    builder.setImage(suggestionImage);
  }

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
    suggestion.suggestionImageUrl,
    upvotes ?? 0,
    downvotes ?? 0,
  );
};

export const getSuggestion: (id: bigint) => Promise<Suggestion | null> = async (
  id: bigint,
) => {
  return await Suggestion.findOne({
    where: {
      id: id,
    },
    include: [SuggestionVote],
  });
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
  suggestionImage: string | undefined,
) => Promise<Suggestion> = async (
  id: bigint,
  userId: bigint,
  messageId: bigint,
  suggestionText: string,
  suggestionImageUrl: string | undefined,
) => {
  return await Suggestion.create({
    id: id,
    suggestionImageUrl: suggestionImageUrl,
    userId: userId,
    suggestionText: suggestionText,
    messageId: messageId,
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

export const getSuggestionVotes: (
  suggestionId: bigint,
) => Promise<SuggestionVote[]> = async (suggestionId: bigint) => {
  return await SuggestionVote.findAll({
    where: {
      suggestionId: suggestionId,
    },
  });
};
