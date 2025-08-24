import { Command } from "djs-slash-helper";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
} from "discord.js";
import { config } from "../../Config.js";
import { actualMention, fakeMention } from "../../util/users.js";

export const UnbanCommand: Command<ApplicationCommandType.ChatInput> = {
  name: "unban",
  description: "Unban a not so baaad boy",
  type: ApplicationCommandType.ChatInput,
  default_permission: false,
  options: [
    {
      type: ApplicationCommandOptionType.String,
      name: "user_id",
      description: "The user id to be unbanned",
      required: true,
    },
    {
      type: ApplicationCommandOptionType.String,
      name: "reason",
      description: "The reason why the user gets unbanned",
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
      const userId = interaction.options.getString("user_id", true);
      const reason = interaction.options.getString("reason", true);

      const user = await interaction.client.users.fetch(userId);

      await interaction.guild.bans.remove(user.id, reason);

      const auditLogChannel = await interaction.guild.channels.fetch(
        config.channels.auditLog,
      );
      if (auditLogChannel?.isTextBased()) {
        await auditLogChannel.send({
          content: `${actualMention(interaction.user)} unbanned ${fakeMention(user)} (${user.id})`,
          allowedMentions: {
            parse: [],
          },
        });
      }

      const unbanMessage = await interaction.followUp({
        content: `Unbanned ${fakeMention(user)} (${user.id})`,
      });

      setTimeout(() => unbanMessage.delete().catch(() => null), 5000);
    } catch (e) {
      console.error("Failed to unban user: ", e);

      if (interaction.replied) {
        await interaction.editReply(
          "Something went wrong! ( User ID incorrect? )",
        );
      } else {
        await interaction.followUp(
          "Something went wrong! ( User ID incorrect? )",
        );
      }
    }
  },
};
