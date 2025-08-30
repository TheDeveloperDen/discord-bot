import type { Command } from "djs-slash-helper";
import { GuildMember } from "discord.js";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
} from "discord.js";
import { createStandardEmbed } from "../../util/embeds.js";
import { parseTimespan } from "../../util/timespan.js";

export const TimeoutCommand: Command<ApplicationCommandType.ChatInput> = {
  type: ApplicationCommandType.ChatInput,
  name: "timeout",
  default_permission: false,
  description: "Times out a user",
  options: [
    {
      type: ApplicationCommandOptionType.User,
      name: "target",
      description: "The user to timeout",
      required: true,
    },
    {
      type: ApplicationCommandOptionType.String,
      name: "duration",
      description: "How long to time out the user for",
      required: true,
    },
    {
      type: ApplicationCommandOptionType.String,
      name: "reason",
      description: "The reason for issuing the timeout",
      required: true,
    },
  ],

  async handle(interaction) {
    // capped at 28 days
    const period = Math.min(
      parseTimespan(interaction.options.get("duration", true).value as string),
      2.419e9,
    );

    if (period === 0) {
      await interaction.reply("Invalid timespan");
    }

    const user = interaction.options.get("target")?.member;
    if (!(user instanceof GuildMember)) {
      await interaction.reply("Could not find user");
      return;
    }
    const reason = interaction.options.get("reason", true).value as string;

    await user.timeout(period, reason);
    await interaction.reply({
      embeds: [
        {
          ...createStandardEmbed(user),
          title: "User timed out",
          description: `<@${user.id}>`,
          fields: [
            {
              name: "Timed out until",
              value: `<t:${((Date.now() + period) / 1000).toFixed(0)}>`,
            },
            {
              name: "Reason",
              value: reason,
            },
          ],
        },
      ],
    });
  },
};

export default TimeoutCommand;
