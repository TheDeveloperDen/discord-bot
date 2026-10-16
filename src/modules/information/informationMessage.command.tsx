import { ButtonStyle, MessageFlags, PermissionFlagsBits } from "discord.js";
import {
	ActionRow,
	Button,
	MediaGallery,
	MediaGalleryItem,
	Message,
	renderDiscordMessage,
} from "disjsx";
import { config } from "../../Config.js";
import { defineContextMenu } from "../../commands/index.js";
import { logger } from "../../logging.js";
import { Card } from "../../ui/index.js";
import type { InformationButton, InformationMessage } from "./information.js";
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

/** The information message as a Components V2 card */
export function renderInformationMessage({
	title,
	description,
	banner,
	buttonRows,
}: InformationMessage) {
	return renderDiscordMessage(
		<Message isV2>
			<Card title={title} description={description}>
				{banner && (
					<MediaGallery>
						<MediaGalleryItem url={banner} />
					</MediaGallery>
				)}
				{buttonRows.map((row, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: rows are static config
					<ActionRow key={i}>
						{row.map((button) => (
							<InformationButtonElement key={button.label} button={button} />
						))}
					</ActionRow>
				))}
			</Card>
		</Message>,
	);
}

export const InformationMessageCommand = defineContextMenu({
	type: "message",
	name: "Set Information Message",
	default_member_permissions: PermissionFlagsBits.ManageGuild,
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
		const newMessage = await interaction.targetMessage.edit({
			...renderInformationMessage(config.informationMessage),
			content: null,
			embeds: [],
		});

		logger.info(`Information message set for ${newMessage.id}`);
		await interaction.reply({
			flags: MessageFlags.Ephemeral,
			content: "Information message set.",
		});
	},
});
