import { MessageFlags } from "discord.js";
import { config } from "../../Config.js";
import { defineCommand, option } from "../../commands/index.js";

import { logger } from "../../logging.js";
import { getOrCreateUserById } from "../../store/models/DDUser.js";
import { Suggestion, SuggestionStatus } from "../../store/models/Suggestion.js";
import { notifyMultipleAchievements } from "../achievements/achievementNotifier.js";
import { checkAndAwardAchievements } from "../achievements/achievementService.js";
import { createSuggestion } from "./suggest.js";
import { renderSuggestion } from "./suggest.post.js";

export const SuggestCommand = defineCommand({
	name: "suggest",
	description: "Create a suggestion",
	options: {
		suggestion: option.string({
			description: "The suggestion",
			required: true,
		}),
	},
	async handle(interaction, { suggestion: suggestionText }) {
		const member = interaction.member;

		await interaction.deferReply({
			flags: MessageFlags.Ephemeral,
		});
		// Get the suggestion and optional image

		const suggestionChannel = await interaction.client.channels.fetch(
			config.suggest.suggestionsChannel,
		);

		if (!suggestionChannel) {
			await interaction.followUp({
				content: "There is no Suggestion channel!",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		if (!suggestionChannel.isSendable() || !suggestionChannel.isTextBased()) {
			await interaction.followUp({
				content:
					"The suggestion channel is either not writeable or not a text channel!",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const suggestionId = interaction.id;

		const response = await suggestionChannel.send({
			...(await renderSuggestion(interaction.client, {
				id: suggestionId,
				submitterId: member.id,
				text: suggestionText,
				status: SuggestionStatus.PENDING,
				upvotes: 0,
				downvotes: 0,
			})),
			allowedMentions: { parse: [] },
		});

		await response.startThread({
			name: "Suggestion discussion thread",
			reason: `User ${member.displayName} created a suggestion`,
		});

		await interaction.followUp({
			content: `Suggestion with the ID \`${suggestionId}\` successfully submitted! See [here](${response.url})`,
			flags: MessageFlags.Ephemeral,
		});

		await createSuggestion(
			BigInt(suggestionId),
			BigInt(member.id),
			BigInt(response.id),
			suggestionText,
		);

		try {
			const userId = BigInt(member.id);
			const ddUser = await getOrCreateUserById(userId);
			const suggestionsSubmitted = await Suggestion.count({
				where: { memberId: userId },
			});
			const newAchievements = await checkAndAwardAchievements(
				ddUser,
				{ type: "suggestion", event: "suggestion_submitted" },
				{ suggestionsSubmitted },
			);

			if (newAchievements.length > 0) {
				await notifyMultipleAchievements(
					interaction.client,
					member,
					newAchievements.map((a) => a.definition),
					suggestionChannel,
				);
			}
		} catch (error) {
			logger.error("Failed to check suggestion achievements", error);
		}
	},
});
