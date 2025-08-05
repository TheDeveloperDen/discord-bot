import { CommandInteraction } from "discord.js";
import { Command } from "djs-slash-helper";
import { ApplicationCommandType } from "discord.js";
import generateHotTake from "./hotTakes.util.js";

export const HotTakeCommand: Command<ApplicationCommandType.ChatInput> = {
  name: "hottake",
  description: "Summon a hot take from the database.",
  type: ApplicationCommandType.ChatInput,
  options: [],

  handle: async (interaction: CommandInteraction) => {
    const guild = interaction.guild;
    if (guild == null) {
      await interaction.reply("Not in a guild");
      return;
    }
    await interaction.deferReply();

    const take = await generateHotTake(guild);
    await interaction.followUp({
      content: take,
      allowedMentions: { users: [] },
    });
  },
};

export default HotTakeCommand;
