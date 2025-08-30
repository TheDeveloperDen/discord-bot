import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
} from "discord.js";
import type { Command } from "djs-slash-helper";
import { config } from "../../Config.js";
import { actualMention, fakeMention } from "../../util/users.js";

export const KickCommand: Command<ApplicationCommandType.ChatInput> = {
  name: "kick",
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

      const member = await interaction.guild.members.fetch(user.id);
      try {
        await user.send({
          content: `You got kicked from ${interaction.guild.name} ${reason ? `with the reason: ${reason}` : ""}`,
        });
      } catch {
        /* empty */
      }
      await member.kick(reason ?? undefined);

      const auditLogChannel = await interaction.guild.channels.fetch(
        config.channels.auditLog,
      );
      if (auditLogChannel?.isTextBased()) {
        await auditLogChannel.send({
          content: `${actualMention(interaction.user)} kicked ${fakeMention(user)} (${user.id})`,
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
