import {
	ActionRowBuilder,
	ApplicationCommandOptionType,
	ApplicationCommandType,
	ButtonBuilder,
	ButtonStyle,
	type ChatInputCommandInteraction,
	type GuildMember,
} from "discord.js";
import type { Command } from "djs-slash-helper";
import { config } from "../../Config.js";
import {
	createSuggestion,
	createSuggestionEmbed,
	SUGGESTION_MANAGE_ID,
	SUGGESTION_NO_ID,
	SUGGESTION_VIEW_VOTES_ID,
	SUGGESTION_YES_ID,
} from "./suggest.js";

export const SuggestCommand: Command<ApplicationCommandType.ChatInput> = {
	name: "suggest",
	description: "Create a suggestion",
	type: ApplicationCommandType.ChatInput,
	options: [
		{
			type: ApplicationCommandOptionType.String,
			name: "suggestion",
			description: "The suggestion",
			required: true,
		},
	],
	handle: async (interaction: ChatInputCommandInteraction) => {
		if (!interaction.member || !interaction.inGuild()) {
			await interaction.reply({
				flags: ["Ephemeral"],
				content: "We are not in a guild?",
			});
		}

		const member = interaction.member as GuildMember;

		await interaction.deferReply({
			flags: ["Ephemeral"],
		});
		// Get the suggestion and optional image
		const suggestionText = interaction.options.get("suggestion")
			?.value as string;

		const suggestionChannel = await interaction.client.channels.fetch(
			config.suggest.suggestionsChannel,
		);

		if (!suggestionChannel) {
			await interaction.followUp({
				content: "There is no Suggestion channel!",
				flags: ["Ephemeral"],
			});
			return;
		}
		if (!suggestionChannel.isSendable() || !suggestionChannel.isTextBased()) {
			await interaction.followUp({
				content:
					"The suggestion channel is either not writeable or not a text channel!",
				flags: ["Ephemeral"],
			});
			return;
		}

		const suggestionId = interaction.id;

		const embed = await createSuggestionEmbed(
			suggestionId,
			member,
			suggestionText,
		);

		const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(SUGGESTION_YES_ID)
				.setStyle(ButtonStyle.Success)
				.setEmoji(config.suggest.yesEmojiId),
			new ButtonBuilder()
				.setCustomId(SUGGESTION_NO_ID)
				.setStyle(ButtonStyle.Danger)
				.setEmoji(config.suggest.noEmojiId),
			new ButtonBuilder()
				.setCustomId(SUGGESTION_VIEW_VOTES_ID)
				.setStyle(ButtonStyle.Secondary)
				.setLabel("View Votes"),
		);
		const response = await suggestionChannel.send({
			embeds: [embed],
			components: [buttons],
		});

		await response.startThread({
			name: "Suggestion discussion thread",
			reason: `User ${member.displayName} created a suggestion`,
		});

		await interaction.followUp({
			content: `Suggestion with the ID \`${suggestionId}\` successfully submitted! See [here](${response.url})`,
			flags: ["Ephemeral"],
		});

		await createSuggestion(
			BigInt(suggestionId),
			BigInt(member.id),
			BigInt(response.id),
			suggestionText,
		);
	},
};
