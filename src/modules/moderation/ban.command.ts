import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
} from "discord.js";
import type { Command } from "djs-slash-helper";
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
      description: "Should the users messages be deleted too? Defaults to True",
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
      const deleteMessages =
        interaction.options.getBoolean("delete_messages") ?? true;
      const user = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason", false);
      try {
        await user.send({
          content: `You got banned from ${interaction.guild.name} ${reason ? `with the reason: ${reason}` : ""}`,
        });
      } catch {
        /* empty */
      }
      await interaction.guild.bans.create(user, {
        reason: reason ?? undefined,
        deleteMessageSeconds: deleteMessages ? 604800 : undefined,
      });

      const auditLogChannel = await interaction.guild.channels.fetch(
        config.channels.auditLog,
      );
      if (auditLogChannel?.isTextBased()) {
        await auditLogChannel.send({
          content: `${actualMention(interaction.user)} banned ${fakeMention(user)} (${user.id})\nDelete Messages: ${deleteMessages}`,
          allowedMentions: {
            parse: [],
          },
        });
      }

      const banMessage = await interaction.followUp({
        content: `Banned ${fakeMention(user)} (${user.id})`,
      });

      setTimeout(() => banMessage.delete().catch(() => null), 5000);
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
