import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  GuildMember,
} from "discord.js";
import { Command } from "djs-slash-helper";
import { config } from "../../Config.js";
import { createSuggestionEmbed } from "./suggest.js";

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

    await interaction.deferReply({
      flags: ["Ephemeral"],
    });
    // Get the suggestion and optional image
    const suggestionText = interaction.options.get("suggestion")
      ?.value as string;

    const suggestionImage = interaction.options.getAttachment("image");

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
      interaction.member as GuildMember,
      suggestionText,
      suggestionImage,
    );
    
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("suggest-ok")
        .setStyle(ButtonStyle.Success)
        .setEmoji(config.suggest.yesEmojiId),
      new ButtonBuilder()
        .setCustomId("suggest-no")
        .setStyle(ButtonStyle.Danger)
        .setEmoji(config.suggest.noEmojiId),
    );
    const response = await suggestionChannel.send({
      embeds: [embed],
      components: [buttons],
    });

    await interaction.followUp({
      content: `Suggestion with the ID \`${suggestionId} successfully submitted! See [here](${response.url})`,
      flags: ["Ephemeral"],
    });
  },
};
