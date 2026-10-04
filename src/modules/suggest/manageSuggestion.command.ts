import {
	ApplicationCommandType,
	MessageFlags,
	PermissionFlagsBits,
} from "discord.js";
import type { Command } from "../../commands/index.js";

import { createSuggestionManageButtons } from "./suggest.js";

export const ManageSuggestionCommand: Command<ApplicationCommandType.Message> =
	{
		name: "Manage Suggestion",
		default_member_permissions: PermissionFlagsBits.ManageMessages,
		type: ApplicationCommandType.Message,
		async handle(interaction) {
			const row = createSuggestionManageButtons();

			await interaction.reply({
				content: "Manage Suggestion",
				components: [row],
				flags: MessageFlags.Ephemeral,
			});
		},
	};
