import type { Command } from "djs-slash-helper";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
} from "discord.js";
import { config } from "../../Config.js";
import { actualMention, fakeMention } from "../../util/users.js";
import { createTempBanModAction } from "./tempBan.js";
import { logger } from "../../logging.js";

export const TempBanCommand: Command<ApplicationCommandType.ChatInput> = {
  name: "tempban",
  description: "Temp Ban a baaaaad boy",
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
      type: ApplicationCommandOptionType.Number,
      name: "ban_duration_days",
      description: "The duration of the ban in days",
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
      const user = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason", false);
      const days = interaction.options.getNumber("ban_duration_days", true);
      const deleteMessages =
        interaction.options.getBoolean("delete_messages", false) ?? true;
      try {
        await user.send({
          content: `You got temp-banned from ${interaction.guild.name} ${reason ? `with the reason: ${reason}` : ""} for ${days} Days`,
        });
      } catch {
        /* empty */
      }

      await interaction.guild.bans.create(user, {
        reason: reason ?? undefined,
        deleteMessageSeconds: deleteMessages ? 604800 : undefined,
      });
      const unbanTimestamp = Math.floor(
        (Date.now() + days * 24 * 60 * 60 * 1000) / 1000,
      );
      await createTempBanModAction(
        interaction.user,
        user,
        new Date(unbanTimestamp),
        reason,
      );

      const auditLogChannel = await interaction.guild.channels.fetch(
        config.channels.auditLog,
      );
      if (auditLogChannel?.isTextBased()) {
        await auditLogChannel.send({
          content: `${actualMention(interaction.user)} temp banned ${fakeMention(user)} (${user.id})\nDelete Messages: ${deleteMessages}\nDays: ${days}\nUntil: <t:${
            unbanTimestamp
          }:R>`,
          allowedMentions: {
            parse: [],
          },
        });
      }

      const tempBanMessage = await interaction.followUp({
        content: `Temp banned ${fakeMention(user)} (${user.id})`,
      });

      setTimeout(() => tempBanMessage.delete().catch(() => null), 5000);
    } catch (e) {
      logger.error("Failed to ban user: ", e);

      if (interaction.replied) {
        await interaction.editReply("Something went wrong!");
      } else {
        await interaction.followUp("Something went wrong!");
      }
    }
  },
};
