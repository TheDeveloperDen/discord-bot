import {
	type ChatInputCommandInteraction,
	Colors,
	chatInputApplicationCommandMention,
	MessageFlags,
	PermissionFlagsBits,
	type User,
} from "discord.js";
import { Message, renderDiscordMessage } from "disjsx";
import { defineCommand, option, subcommand } from "../../commands/index.js";
import { logger } from "../../logging.js";
import { getOrCreateUserById } from "../../store/models/DDUser.js";
import { Card, ephemeral, Field } from "../../ui/index.js";
import { actualMention } from "../../util/users.js";
import { notifyGitHubLinkStatusChange } from "./github.notification.js";
import { GitHubService } from "./github.service.js";

/** The part of an interaction the unlink handlers use, so tests don't need a full one */
type UnlinkInteraction = Pick<ChatInputCommandInteraction, "user" | "reply">;

const LinkSubcommand = subcommand({
	description: "Link your GitHub account to your profile",
	async handle(interaction) {
		const userId = interaction.user.id;

		try {
			const { url } = GitHubService.generateAuthUrl(userId, {
				guildId: interaction.guildId,
				channelId: interaction.channelId,
				onLinked: (githubUsername) =>
					interaction.editReply(
						renderDiscordMessage(
							<Message isV2>
								<Card
									accent={Colors.Green}
									title="GitHub Account Linked"
									description={`Linked as **${githubUsername}**.`}
								/>
							</Message>,
						),
					),
			});

			await interaction.reply(
				ephemeral(
					<Card
						title="Link GitHub Account"
						description={`Click the link below to authorise the bot and link your GitHub account.\n\n**[Authorize GitHub](${url})**`}
						footer="The link expires in 10 minutes."
					/>,
				),
			);
		} catch (error) {
			logger.error("Failed to generate GitHub authorization link", error);
			await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content:
					"Failed to generate authorisation link. Please contact a moderator.",
			});
		}
	},
});

const StatusSubcommand = subcommand({
	description: "Check your GitHub link status",
	async handle(interaction) {
		const ddUser = await getOrCreateUserById(BigInt(interaction.user.id));

		if (!ddUser.githubId) {
			await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: `Your GitHub account is not linked. Use ${chatInputApplicationCommandMention("github", "link", interaction.commandId)} to link it!`,
			});
			return;
		}

		await interaction.reply(
			ephemeral(
				<Card accent={Colors.Green} title="✅ GitHub Account Linked">
					<Field label="Username">{ddUser.githubUsername || "Unknown"}</Field>
					<Field label="GitHub ID">{ddUser.githubId}</Field>
				</Card>,
			),
		);
	},
});

export async function unlinkSelf(interaction: UnlinkInteraction) {
	const ddUser = await getOrCreateUserById(BigInt(interaction.user.id));

	if (!ddUser.githubId) {
		await interaction.reply({
			flags: MessageFlags.Ephemeral,
			content: "You don't have a GitHub account linked. Nothing to unlink.",
		});
		return;
	}

	const previousUsername = ddUser.githubUsername || "Unknown";

	ddUser.githubId = null;
	ddUser.githubUsername = null;
	await ddUser.save();

	try {
		await interaction.reply({
			flags: MessageFlags.Ephemeral,
			content: `Successfully unlinked GitHub account **${previousUsername}** from your profile.`,
		});
	} finally {
		await notifyGitHubLinkStatusChange(interaction.user, {
			kind: "unlinked",
			githubUsername: previousUsername,
			actor: "self",
		});
	}
}

const UnlinkSubcommand = subcommand({
	description: "Unlink your GitHub account from your profile",
	handle: unlinkSelf,
});

export async function unlinkMember(
	interaction: UnlinkInteraction,
	targetUser: User,
) {
	const ddUser = await getOrCreateUserById(BigInt(targetUser.id));

	if (!ddUser.githubId) {
		await interaction.reply({
			flags: MessageFlags.Ephemeral,
			content: `${actualMention(targetUser)} doesn't have a GitHub account linked. Nothing to unlink.`,
		});
		return;
	}

	const previousUsername = ddUser.githubUsername || "Unknown";

	ddUser.githubId = null;
	ddUser.githubUsername = null;
	await ddUser.save();

	try {
		await interaction.reply({
			flags: MessageFlags.Ephemeral,
			content: `Successfully unlinked GitHub account **${previousUsername}** from <@${targetUser.id}>.`,
		});
	} finally {
		await notifyGitHubLinkStatusChange(targetUser, {
			kind: "unlinked",
			githubUsername: previousUsername,
			actor: "administrator",
		});
	}
}

const AdminUnlinkSubcommand = subcommand({
	description: "Forcefully unlink a user's GitHub account",
	options: {
		user: option.user({
			description: "The Discord user whose GitHub link to remove",
			required: true,
		}),
	},
	handle: (interaction, { user }) => unlinkMember(interaction, user),
});

export const GitHubCommand = defineCommand({
	name: "github",
	description: "Manage your GitHub account linkage",
	subcommands: {
		link: LinkSubcommand,
		status: StatusSubcommand,
		unlink: UnlinkSubcommand,
	},
});

export const GitHubAdminCommand = defineCommand({
	name: "github-admin",
	description: "Manage other members' GitHub account linkage",
	default_member_permissions: PermissionFlagsBits.Administrator,
	subcommands: {
		unlink: AdminUnlinkSubcommand,
	},
});
