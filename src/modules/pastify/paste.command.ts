import { config } from "../../Config.js";
import { defineCommand } from "../../commands/index.js";

export const PasteCommand = defineCommand({
	name: "paste",
	description: "Show the paste link",

	handle: async (interaction) => await interaction.reply(config.devbin.url),
});
