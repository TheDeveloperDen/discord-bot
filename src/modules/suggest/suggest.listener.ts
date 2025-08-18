import { EventListener } from "../module.js";
import { GuildMember, Interaction } from "discord.js";
import {
  createSuggestionEmbedFromEntity,
  getSuggestionByMessageId,
  SUGGESTION_NO_ID,
  SUGGESTION_YES_ID,
  SuggestionVoteType,
  upsertVote,
} from "./suggest.js";

const SUGGESTION_BUTTON_MAP: {
  [key: string]: SuggestionVoteType;
} = {
  "suggestion-no": -1,
  "suggestion-yes": 1,
};

export const SuggestionButtonListener: EventListener = {
  async interactionCreate(client, interaction: Interaction) {
    if (
      interaction.isButton() &&
      interaction.member &&
      (interaction.customId === SUGGESTION_NO_ID ||
        interaction.customId === SUGGESTION_YES_ID)
    ) {
      if (!interaction.message.editable) {
        await interaction.reply({
          content: "This suggestion is no longer editable!",
          flags: ["Ephemeral"],
        });
        return;
      }
      const member = interaction.member as GuildMember;

      await interaction.deferReply({ flags: ["Ephemeral"] });

      const votingValue = SUGGESTION_BUTTON_MAP[
        interaction.customId as keyof typeof SUGGESTION_BUTTON_MAP
      ] as SuggestionVoteType;

      const suggestion = await getSuggestionByMessageId(
        BigInt(interaction.message.id),
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
        embeds: [
          await createSuggestionEmbedFromEntity(
            suggestion,
            interaction.member as GuildMember,
          ),
        ],
      });

      let content = `You ${previousVoteValue && previousVoteValue === votingValue ? "already " : ""}voted ${votingValue === 1 ? "**Yes**" : "**No**"} on this suggestion`;
      if (previousVoteValue && previousVoteValue !== votingValue) {
        content = `You changed your vote from ${previousVoteValue === 1 ? "**Yes**" : "**No**"} to ${votingValue === 1 ? "**Yes**" : "**No**"} on this suggestion`;
      }
      await interaction.followUp({
        content: content,
        flags: ["Ephemeral"],
      });
    }
  },
};
