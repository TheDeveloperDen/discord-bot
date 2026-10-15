import {
	type ButtonInteraction,
	type GuildMember,
	MessageFlags,
} from "discord.js";
import { ActionRow, Message, renderDiscordMessage, SelectOption } from "disjsx";
import { defineComponent } from "../../components/index.js";
import { FAQ } from "../../store/models/FAQ.js";
import { getEmoji, toAPIMessageComponentEmoji } from "../../util/emojis.js";

import { truncateTo } from "../../util/strings.js";
import { createFaqEmbed } from "../faq/faq.util.js";
import { getResourceEmbed } from "../learning/learning.command.js";
import {
	getAllCachedResources,
	getResource,
} from "../learning/resourcesCache.util.js";

const LearningResourcePicker = defineComponent({
	id: "information:learningPicker",
	kind: "stringSelect",
	async handle(interaction) {
		const [resourceName] = interaction.values;
		if (resourceName === undefined) return;
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		const resource = await getResource(resourceName);
		if (resource == null) {
			await interaction.followUp({
				content: "That resource no longer exists",
				flags: MessageFlags.Ephemeral,
			});
			return;
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
	},
});

export const LearningResourcesButton = defineComponent({
	id: "information:learning",
	kind: "button",
	handle: sendLearningResourcesPicker,
});

export const FaqButton = defineComponent({
	id: "information:faq",
	kind: "button",
	args: ["name"],
	async handle(interaction, { name }) {
		await interaction.deferReply({ flags: "Ephemeral" });
		const faq = await FAQ.findOne({ where: { name } });

		if (faq == null) {
			await interaction.followUp({
				content: `No FAQ found named \`${name}\``,
				flags: MessageFlags.Ephemeral,
			});
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
});

export const InformationComponents = [
	LearningResourcePicker,
	LearningResourcesButton,
	FaqButton,
];

async function sendLearningResourcesPicker(interaction: ButtonInteraction) {
	const options = getAllCachedResources().map(([file, res]) => {
		const emoji = res.emoji && getEmoji(interaction.client, res.emoji);
		return (
			<SelectOption
				key={file}
				label={res.name.toString()}
				value={file}
				description={truncateTo(res.description, 100)}
				emoji={emoji ? toAPIMessageComponentEmoji(emoji) : undefined}
			/>
		);
	});

	await interaction.reply(
		renderDiscordMessage(
			<Message flags={MessageFlags.Ephemeral}>
				<ActionRow>
					<LearningResourcePicker placeholder="Select a resource">
						{options}
					</LearningResourcePicker>
				</ActionRow>
			</Message>,
		),
	);
}
