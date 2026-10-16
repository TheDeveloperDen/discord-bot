import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { defineContextMenu } from "../../commands/index.js";
import { pastify } from "./pastify.js";

export const PastifyCommand = defineContextMenu({
	type: "message",
	name: "Pastify",
	default_member_permissions: PermissionFlagsBits.ManageMessages,
	async handle(interaction) {
		const pastified = await pastify(interaction.targetMessage, 10);
		if (pastified == null) {
			await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content:
					"There's no code in that message to paste, or the paste failed, so I left it alone.",
			});
			return;
		}
		await interaction.reply(pastified);
	},
});
