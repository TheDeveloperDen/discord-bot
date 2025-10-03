import { ApplicationCommandType } from "discord.js";
import type { Command } from "djs-slash-helper";
import { EPHEMERAL_FLAG } from "../../util/message.js";
import { createSuggestionManageButtons } from "./suggest.js";

export const ManageSuggestionCommand: Command<ApplicationCommandType.Message> =
	{
		name: "Manage Suggestion",
		default_permission: false,
		type: ApplicationCommandType.Message,
		async handle(interaction) {
			const row = createSuggestionManageButtons();

			await interaction.reply({
				content: "Manage Suggestion",
				components: [row],
				flags: EPHEMERAL_FLAG,
			});
		},
	};
