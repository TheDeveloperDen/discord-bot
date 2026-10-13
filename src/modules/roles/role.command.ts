import { config } from "../../Config.js";
import { defineCommand } from "../../commands/index.js";

export const NoPingCommand = defineCommand({
	name: "no-ping",
	description: "Toggle whether or not the bot will ping you",

	handle: async (interaction) => {
		const user = interaction.member;
		if (user.roles.cache.has(config.roles.noPing)) {
			await user.roles.remove(config.roles.noPing);
			await interaction.reply("You will be pinged now!");
		} else {
			await user.roles.add(config.roles.noPing);
			await interaction.reply("You will no longer be pinged!");
		}
	},
});
