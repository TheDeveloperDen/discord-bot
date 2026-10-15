import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { defineContextMenu } from "../../commands/index.js";

import { createSuggestionManageButtons } from "./suggest.js";

export const ManageSuggestionCommand = defineContextMenu({
	type: "message",
	name: "Manage Suggestion",
	default_member_permissions: PermissionFlagsBits.ManageMessages,
	async handle(interaction) {
		const row = createSuggestionManageButtons();

		await interaction.reply({
			content: "Manage Suggestion",
			components: [row],
			flags: MessageFlags.Ephemeral,
		});
	},
});
