import { Attachment, EmbedBuilder, GuildMember } from "discord.js";
import { createStandardEmbed } from "../../util/embeds.js";
import { fakeMention } from "../../util/users.js";
import { Suggestion } from "../../store/models/Suggestion.js";
import { SuggestionVotes } from "../../store/models/SuggestionVotes.js";

export const SUGGESTION_ID_EMBED_FIELD_NAME = "Suggestion ID";
export const SUGGESTION_UPVOTE_EMBED_FIELD_NAME = ":white_check_mark:";
export const SUGGESTION_DOWNVOTE_EMBED_FIELD_NAME = ":x:";

export const createSuggestionEmbed: (
  id: string,
  member: GuildMember,
  suggestionText: string,
  suggestionImage: Attachment | null,
) => EmbedBuilder = (
  id: string,
  member: GuildMember,
  suggestionText: string,
  suggestionImage: Attachment | null,
) => {
  const builder = createStandardEmbed(member).addFields([
    {
      name: "Submitter",
      value: fakeMention(member.user),
      inline: true,
    },
    {
      name: SUGGESTION_ID_EMBED_FIELD_NAME,
      value: id,
    },
    {
      name: "Suggestion",
      value: suggestionText,
    },
    {
      name: "Current Votes",
      value: "-------------",
    },
    {
      name: SUGGESTION_UPVOTE_EMBED_FIELD_NAME,
      value: "0",
    },
    {
      name: SUGGESTION_DOWNVOTE_EMBED_FIELD_NAME,
      value: "0",
    },
  ]);

  if (suggestionImage) {
    builder.setImage(suggestionImage.proxyURL);
  }

  return builder;
};

export const getSuggestion: (id: bigint) => Promise<Suggestion | null> = async (
  id: bigint,
) => {
  return await Suggestion.findOne({
    where: {
      id: id,
    },
    include: [SuggestionVotes],
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
    suggestiontText: suggestionText,
    messageId: messageId,
  });
};
