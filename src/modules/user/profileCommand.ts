import { AttachmentBuilder, MessageFlags } from "discord.js";
import { defineCommand } from "../../commands/index.js";
import { getProfileEmbed } from "./user.js";

export const ProfileCommand = defineCommand({
	name: "profile",
	description: "Look at your profile",
	default_member_permissions: 0n,
	async handle(interaction) {
		const profile = await getProfileEmbed(interaction.member);
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
		});
	},
});
