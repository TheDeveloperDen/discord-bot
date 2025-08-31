import type { CommandInteraction } from "discord.js";
import { config } from "../../Config.js";
import type { Command } from "djs-slash-helper";
import { ApplicationCommandType } from "discord.js";

export const PasteCommand: Command<ApplicationCommandType.ChatInput> = {
  name: "paste",
  description: "Show the paste link",
  type: ApplicationCommandType.ChatInput,
  options: [],

  handle: async (interaction: CommandInteraction) =>
    await interaction.reply(config.pastebin.url),
};
