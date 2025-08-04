import {
  ApplicationCommandOptionType,
  range,
} from "discord.js";
import { Command } from "djs-slash-helper";
import { ApplicationCommandType } from "discord-api-types/v10";
import generateHotTake from "./hotTakes.util.js";
import { upload } from "../pastify/pastify.js";

export const ManyHotTakesCommand: Command<ApplicationCommandType.ChatInput> = {
  name: "manyhottakes",
  description: "Summon MANY hot takes from the database.",
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      type: ApplicationCommandOptionType.Integer,
      name: "count",
      description: "The number of hot takes to summon.",
      required: true,
    },
  ],

  handle: async (interaction) => {
    const count = interaction.options.get("count", true).value as number;
    const guild = interaction.guild;
    if (guild == null) {
      await interaction.reply("Not in a guild");
      return;
    }
    await interaction.deferReply();
    const takes = await Promise.all(
      Array.from(range(count)).map(async () => await generateHotTake(guild))
    ).then((x) => x.join("\n\n"));

    if (count > 10 || takes.length > 2000) {
      const pastebinURL = await upload({ content: takes });
      await interaction.followUp({ content: pastebinURL });
    } else {
      await interaction.followUp({
        content: takes,
        allowedMentions: { users: [] },
      });
    }
  },
};

export default ManyHotTakesCommand;
