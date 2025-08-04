import { config } from "../../Config.js";
import { Command } from "djs-slash-helper";
import { GuildMember } from "discord.js";
import { ApplicationCommandType } from "discord-api-types/v10";
import * as Sentry from "@sentry/node";

export const NoPingCommand: Command<ApplicationCommandType.ChatInput> = {
  name: "no-ping",
  description: "Toggle whether or not the bot will ping you",
  type: ApplicationCommandType.ChatInput,
  options: [],

  handle: async (interaction) =>
    await Sentry.startSpan({ name: "NoPingCommand#handle" }, async () => {
      const user = interaction.member as GuildMember;
      if (user == null) {
        return await interaction.reply(
          "You must be a member of this server to use this command.",
        );
      }
      if (user.roles.cache.has(config.roles.noPing)) {
        await user.roles.remove(config.roles.noPing);
        await interaction.reply("You will be pinged now!");
      } else {
        await user.roles.add(config.roles.noPing);
        await interaction.reply("You will no longer be pinged!");
      }
    }),
};
