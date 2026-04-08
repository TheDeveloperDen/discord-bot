import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	EmbedBuilder,
	MessageFlags,
} from "discord.js";
import type { Command, ExecutableSubcommand } from "djs-slash-helper";
import { getOrCreateUserById } from "../../store/models/DDUser.js";
import { GitHubService } from "./github.service.js";

const LinkSubcommand: ExecutableSubcommand = {
	type: ApplicationCommandOptionType.Subcommand,
	name: "link",
	description: "Link your GitHub account to your profile",
	async handle(interaction) {
		const userId = interaction.user.id;

		try {
			const { url } = GitHubService.generateAuthUrl(userId);

			const embed = new EmbedBuilder()
				.setTitle("🔗 Link GitHub Account")
				.setDescription(
					`Click the link below to authorize the bot and link your GitHub account.\n\n**[Authorize GitHub](${url})**`,
				)
				.setFooter({ text: "The link expires in 10 minutes." })
				.setColor(0x333333);

			await interaction.reply({
				embeds: [embed],
				flags: MessageFlags.Ephemeral,
			});
		} catch (error) {
			console.error(error);
			await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content:
					"❌ Failed to generate authorization link. Please contact a moderator.",
			});
		}
	},
};

const StatusSubcommand: ExecutableSubcommand = {
	type: ApplicationCommandOptionType.Subcommand,
	name: "status",
	description: "Check your GitHub link status",
	async handle(interaction) {
		const ddUser = await getOrCreateUserById(BigInt(interaction.user.id));

		if (!ddUser.githubId) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content:
					"❌ Your GitHub account is not linked. Use `/github link` to link it!",
			});
		}

		const embed = new EmbedBuilder()
			.setTitle("✅ GitHub Account Linked")
			.addFields(
				{
					name: "Username",
					value: ddUser.githubUsername || "Unknown",
					inline: true,
				},
				{ name: "GitHub ID", value: ddUser.githubId, inline: true },
			)
			.setColor(0x00ff00);

		await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
	},
};

const UnlinkSubcommand: ExecutableSubcommand = {
	type: ApplicationCommandOptionType.Subcommand,
	name: "unlink",
	description: "Unlink your GitHub account from your profile",
	async handle(interaction) {
		const ddUser = await getOrCreateUserById(BigInt(interaction.user.id));

		if (!ddUser.githubId) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content:
					"❌ You don't have a GitHub account linked. Nothing to unlink.",
			});
		}

		const previousUsername = ddUser.githubUsername || "Unknown";

		ddUser.githubId = null;
		ddUser.githubUsername = null;
		await ddUser.save();

		await interaction.reply({
			flags: MessageFlags.Ephemeral,
			content: `✅ Successfully unlinked GitHub account **${previousUsername}** from your profile.`,
		});
	},
};

const AdminUnlinkSubcommand: ExecutableSubcommand = {
	type: ApplicationCommandOptionType.Subcommand,
	name: "admin-unlink",
	description: "Forcefully unlink a user's GitHub account (staff only)",
	options: [
		{
			type: ApplicationCommandOptionType.User,
			name: "user",
			description: "The Discord user whose GitHub link to remove",
			required: true,
		},
	],
	async handle(interaction) {
		const targetUser = interaction.options.getUser("user", true);
		const ddUser = await getOrCreateUserById(BigInt(targetUser.id));

		if (!ddUser.githubId) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: `❌ <@${targetUser.id}> doesn't have a GitHub account linked. Nothing to unlink.`,
			});
		}

		const previousUsername = ddUser.githubUsername || "Unknown";

		ddUser.githubId = null;
		ddUser.githubUsername = null;
		await ddUser.save();

		await interaction.reply({
			flags: MessageFlags.Ephemeral,
			content: `✅ Successfully unlinked GitHub account **${previousUsername}** from <@${targetUser.id}>.`,
		});
	},
};

export const GitHubCommand: Command<ApplicationCommandType.ChatInput> = {
	name: "github",
	description: "Manage your GitHub account linkage",
	type: ApplicationCommandType.ChatInput,
	options: [
		LinkSubcommand,
		StatusSubcommand,
		UnlinkSubcommand,
		AdminUnlinkSubcommand,
	],
	handle() {},
};
