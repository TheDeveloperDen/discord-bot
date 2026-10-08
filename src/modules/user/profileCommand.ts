import {
	ActionRowBuilder,
	ApplicationCommandType,
	AttachmentBuilder,
	ButtonBuilder,
	ButtonStyle,
	type GuildMember,
	MessageFlags,
} from "discord.js";
import type { Command } from "../../commands/index.js";
import { getProfileEmbed } from "./user.js";

export const ProfileCommand: Command<ApplicationCommandType.ChatInput> = {
	name: "profile",
	description: "Look at your profile",
	default_member_permissions: 0n,
	type: ApplicationCommandType.ChatInput,
	options: [],
	async handle(interaction) {
		if (!interaction.member) {
			await interaction.reply({
				content: "Sorry this can only be invoked in a guild!",
				flags: "Ephemeral",
			});
			return;
		}
		const profile = await getProfileEmbed(interaction.member as GuildMember);

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
};
