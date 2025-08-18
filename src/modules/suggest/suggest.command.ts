import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  Attachment,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  GuildMember,
} from "discord.js";
import { Command } from "djs-slash-helper";
import { config } from "../../Config.js";
import {
  createSuggestion,
  createSuggestionEmbed,
  SUGGESTION_NO_ID,
  SUGGESTION_YES_ID,
} from "./suggest.js";

function isEmbeddableImage(attachment: Attachment): boolean {
  if (!attachment.contentType) return false;

  // Check for standard image types and GIFs that can be embedded
  const embeddableTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];

  return embeddableTypes.includes(attachment.contentType.toLowerCase());
}

export const SuggestCommand: Command<ApplicationCommandType.ChatInput> = {
  name: "suggest",
  description: "Create a suggestion",
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      type: ApplicationCommandOptionType.String,
      name: "suggestion",
      description: "The suggestion",
      required: true,
    },
    {
      type: ApplicationCommandOptionType.Attachment,
      name: "image",
      description: "Image that is relevant to the suggestion",
      required: false,
    },
  ],
  handle: async (interaction: ChatInputCommandInteraction) => {
    if (!interaction.member || !interaction.inGuild()) {
      await interaction.reply({
        flags: ["Ephemeral"],
        content: "We are not in a guild?",
      });
    }

    const member = interaction.member as GuildMember;

    await interaction.deferReply({
      flags: ["Ephemeral"],
    });
    // Get the suggestion and optional image
    const suggestionText = interaction.options.get("suggestion")
      ?.value as string;

    const suggestionImage = interaction.options.getAttachment("image");

    if (suggestionImage && !isEmbeddableImage(suggestionImage)) {
      await interaction.followUp({
        content: "Your upload needs to be a image!",
      });
      return;
    }

    const suggestionChannel = await interaction.client.channels.fetch(
      config.suggest.suggestionsChannel,
    );

    if (!suggestionChannel) {
      await interaction.followUp({
        content: "There is no Suggestion channel!",
        flags: ["Ephemeral"],
      });
      return;
    }
    if (!suggestionChannel.isSendable() || !suggestionChannel.isTextBased()) {
      await interaction.followUp({
        content:
          "The suggestion channel is either not writeable or not a text channel!",
        flags: ["Ephemeral"],
      });
      return;
    }

    const suggestionId = interaction.id;

    const embed = createSuggestionEmbed(
      suggestionId,
      member,
      suggestionText,
      suggestionImage?.proxyURL,
    );

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(SUGGESTION_YES_ID)
        .setStyle(ButtonStyle.Success)
        .setEmoji(config.suggest.yesEmojiId),
      new ButtonBuilder()
        .setCustomId(SUGGESTION_NO_ID)
        .setStyle(ButtonStyle.Danger)
        .setEmoji(config.suggest.noEmojiId),
    );
    const response = await suggestionChannel.send({
      embeds: [embed],
      components: [buttons],
    });

    await response.startThread({
      name: "Suggestion discussion thread",
      reason: `User ${member.displayName} created a suggestion`,
    });

    await interaction.followUp({
      content: `Suggestion with the ID \`${suggestionId} successfully submitted! See [here](${response.url})`,
      flags: ["Ephemeral"],
    });

    await createSuggestion(
      BigInt(suggestionId),
      BigInt(member.id),
      BigInt(response.id),
      suggestionText,
      suggestionImage?.proxyURL,
    );
  },
};
