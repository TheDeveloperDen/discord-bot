import type { Message } from "discord.js";
import { ApplicationCommandType, PermissionFlagsBits } from "discord.js";
import type { Command } from "../../commands/index.js";
import { pastify } from "./pastify.js";

export const PastifyCommand: Command<ApplicationCommandType.Message> = {
	name: "Pastify",
	default_member_permissions: PermissionFlagsBits.ManageMessages,
	type: ApplicationCommandType.Message,
	async handle(interaction) {
		const message = interaction.options.data[0].message;
		const options = await pastify(message as Message, true, 10);
		await interaction.reply(options);
	},
};
