import {
	type APIEmbed,
	ApplicationCommandType,
	ButtonStyle,
	MessageFlags,
	PermissionFlagsBits,
} from "discord.js";
import { ActionRow, Button, Message, renderDiscordMessage } from "disjsx";
import { config } from "../../Config.js";
import type { Command } from "../../commands/index.js";
import { logger } from "../../logging.js";
import { createStandardEmbed } from "../../util/embeds.js";
import type { InformationButton } from "./information.js";
import {
	FaqButton,
	LearningResourcesButton,
} from "./informationMessage.components.js";

const InformationButtonElement = ({
	button,
}: {
	button: InformationButton;
}) => {
	const { label, emoji } = button;
	switch (button.type) {
		case "link":
			return (
				<Button
					style={ButtonStyle.Link}
					url={button.url}
					label={label}
					emoji={emoji}
				/>
			);
		case "faq":
			return (
				<FaqButton
					name={button.faqId}
					style={button.style}
					label={label}
					emoji={emoji}
				/>
			);
		case "learning":
			return (
				<LearningResourcesButton
					style={button.style}
					label={label}
					emoji={emoji}
				/>
			);
	}
};

/** The information message's button rows, as message components */
export function renderInformationButtons(rows: InformationButton[][]) {
	return (
		renderDiscordMessage(
			<Message>
				{rows.map((row, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: rows are static config
					<ActionRow key={i}>
						{row.map((button) => (
							<InformationButtonElement key={button.label} button={button} />
						))}
					</ActionRow>
				))}
			</Message>,
		).components ?? []
	);
}

export const InformationMessageCommand: Command<ApplicationCommandType.Message> =
	{
		name: "Set Information Message",
		default_member_permissions: PermissionFlagsBits.ManageGuild,
		type: ApplicationCommandType.Message,
		async handle(interaction) {
			if (!interaction.targetMessage.editable) {
				await interaction.reply({
					flags: MessageFlags.Ephemeral,
					content: "I can't edit that message.",
				});
				return;
			}

			if (config.informationMessage == null) {
				await interaction.reply({
					flags: MessageFlags.Ephemeral,
					content: "There is no information message configured.",
				});
				return;
			}
			const informationMessage = config.informationMessage;
			const embed: APIEmbed = {
				...createStandardEmbed().data,
				...informationMessage.embed.data,
			};
			const newMessage = await interaction.targetMessage.edit({
				content: informationMessage.content ?? null,
				embeds: [embed],
				components: renderInformationButtons(informationMessage.buttonRows),
			});

			logger.info(
				`Information message set for ${newMessage.id} with content ${newMessage.content} and embed ${JSON.stringify(
					newMessage.embeds[0],
				)}`,
			);
			await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "Information message set.",
			});
		},
	};
