import { ApplicationCommandType } from "discord.js";
import type { Command } from "../../commands/index.js";

export const BlockCountCommand: Command<ApplicationCommandType.ChatInput> = {
	type: ApplicationCommandType.ChatInput,
	name: "blockcount",
	description: "Launch BlockCount",
	options: [],
	async handle(interaction) {
		await interaction.launchActivity();
	},
};
