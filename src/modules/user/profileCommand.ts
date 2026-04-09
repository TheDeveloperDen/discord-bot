import {
	ActionRowBuilder,
	AttachmentBuilder,
	ButtonBuilder,
	ButtonStyle,
	MessageFlags,
} from "discord.js";
import { defineCommand } from "../../commands/index.js";
import { getProfileEmbed } from "./user.js";

export const ProfileCommand = defineCommand({
	name: "profile",
	description: "Look at your profile",
	async handle(interaction) {
		const profile = await getProfileEmbed(interaction.member);

		const components: ActionRowBuilder<ButtonBuilder>[] = [];
		if (profile.githubUsername) {
			components.push(
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder()
						.setLabel("GitHub Profile")
						.setStyle(ButtonStyle.Link)
						.setURL(`https://github.com/${profile.githubUsername}`),
				),
			);
		}

		await interaction.reply({
			flags: MessageFlags.Ephemeral,
			files: [
				new AttachmentBuilder(
					Buffer.from(
						profile.image.replace(/^data:image\/png;base64,/, ""),
						"base64",
					),
					{
						name: "profile.png",
						description: "The Profile Image",
					},
				),
			],
			components,
		});
	},
});
