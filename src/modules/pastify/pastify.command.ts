import { PermissionFlagsBits } from "discord.js";
import { defineContextMenu } from "../../commands/index.js";
import { pastify } from "./pastify.js";

export const PastifyCommand = defineContextMenu({
	type: "message",
	name: "Pastify",
	default_member_permissions: PermissionFlagsBits.ManageMessages,
	async handle(interaction) {
		const options = await pastify(interaction.targetMessage, true, 10);
		await interaction.reply(options);
	},
});
