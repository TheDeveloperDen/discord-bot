import { Command } from "djs-slash-helper";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
} from "discord.js";
import { config } from "../../Config.js";
import { actualMention, fakeMention } from "../../util/users.js";

export const BanCommand: Command<ApplicationCommandType.ChatInput> = {
  name: "ban",
  description: "Ban a baaaaad boy",
  type: ApplicationCommandType.ChatInput,
  default_permission: false,
  options: [
    {
      type: ApplicationCommandOptionType.User,
      name: "user",
      description: "The user to be banned",
      required: true,
    },
    {
      type: ApplicationCommandOptionType.String,
      name: "reason",
      description: "The reason why the user gets banned",
    },
    {
      type: ApplicationCommandOptionType.Boolean,
      name: "delete_messages",
      description:
        "Should the users messages be deleted too? Defaults to False",
    },
  ],

  handle: async (interaction) => {
    if (
      !interaction.isChatInputCommand() ||
      !interaction.inGuild() ||
      interaction.guild === null
    )
      return;
    try {
      await interaction.deferReply();
      const user = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason", true);

      const member = await interaction.guild.members.fetch(user.id);

      await member.kick(reason);

      const auditLogChannel = await interaction.guild.channels.fetch(
        config.channels.auditLog,
      );
      if (auditLogChannel?.isTextBased()) {
        await auditLogChannel.send({
          content: `${actualMention(interaction.user)} kicked ${fakeMention(user)} (${user.id})\n`,
          allowedMentions: {
            parse: [],
          },
        });
      }

      const kickMessage = await interaction.followUp({
        content: `Kicked ${fakeMention(user)} (${user.id})`,
      });

      setTimeout(() => kickMessage.delete().catch(() => null), 5000);
    } catch (e) {
      console.error("Failed to ban user: ", e);

      if (interaction.replied) {
        await interaction.editReply("Something went wrong!");
      } else {
        await interaction.followUp("Something went wrong!");
      }
    }
  },
};
