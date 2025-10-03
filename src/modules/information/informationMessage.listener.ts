import {
	ActionRowBuilder,
	type ButtonInteraction,
	type GuildMember,
	type Interaction,
	MessageFlags,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
} from "discord.js";
import { FAQ } from "../../store/models/FAQ.js";
import { getEmoji, toAPIMessageComponentEmoji } from "../../util/emojis.js";

import { truncateTo } from "../../util/strings.js";
import { createFaqEmbed } from "../faq/faq.util.js";
import { getResourceEmbed } from "../learning/learning.command.js";
import {
	getAllCachedResources,
	getResource,
} from "../learning/resourcesCache.util.js";
import type { EventListener } from "../module.js";

export const InformationButtonListener: EventListener = {
	async interactionCreate(_, interaction: Interaction) {
		if (
			interaction.isStringSelectMenu() &&
			interaction.customId === "learningResourcePicker"
		) {
			const resourceName = interaction.values[0];
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			const resource = await getResource(resourceName);
			if (resource == null) {
				return; // shouldn't ever happen
			}
			const embed = getResourceEmbed(
				interaction.client,
				resource,
				interaction.user,
				(interaction.member as GuildMember) ?? undefined,
			);

			await interaction.followUp({
				embeds: [embed],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		if (!interaction.isButton()) {
			return;
		}
		const id = interaction.customId;
		if (id === "learning-resources") {
			await sendLearningResourcesPicker(interaction);
			return;
		}
		if (!id.startsWith("faq-")) {
			return;
		}
		const faqId = id.substring(4);
		await interaction.deferReply({ flags: "Ephemeral" });
		const faq = await FAQ.findOne({
			where: {
				name: faqId,
			},
		});

		if (faq == null) {
			return;
		}
		const embed = createFaqEmbed(
			faq,
			interaction.user,
			(interaction.member as GuildMember) ?? undefined,
		);
		await interaction.followUp({
			flags: MessageFlags.Ephemeral,
			embeds: [embed],
		});
	},
};

async function sendLearningResourcesPicker(interaction: ButtonInteraction) {
	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId("learningResourcePicker")
		.setPlaceholder("Select a resource")
		.setOptions(
			getAllCachedResources().map(([file, res]) => {
				const builder = new StringSelectMenuOptionBuilder()
					.setLabel(res.name)
					.setValue(file)
					.setDescription(truncateTo(res.description, 100));
				if (res.emoji) {
					const parse = getEmoji(interaction.client, res.emoji);
					if (parse) {
						builder.setEmoji(toAPIMessageComponentEmoji(parse));
					}
				}
				return builder;
			}),
		);

	await interaction.reply({
		components: [
			new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu),
		],
		flags: MessageFlags.Ephemeral,
		withResponse: false,
	});
}
