import {
	type ActionRowBuilder,
	ApplicationCommandOptionType,
	ApplicationCommandType,
	type ButtonBuilder,
	type EmbedBuilder,
	PermissionFlagsBits,
} from "discord.js";
import type { Command, ExecutableSubcommand } from "djs-slash-helper";
import { getMemberFromInteraction } from "../../util/member.js";
import { safelyFetchUser } from "../../util/users.js";
import { createModMailDetails, getActiveModMailByChannel } from "./modmail.js";

const DetailsSubCommand: ExecutableSubcommand = {
	type: ApplicationCommandOptionType.Subcommand,
	name: "details",
	description: "Get details about the current thread.",
	async handle(interaction) {
		await interaction.deferReply({
			flags: ["Ephemeral"],
		});
		if (interaction.inGuild()) {
			if (!interaction.channel?.isThread()) {
				await interaction.followUp({
					content: "This command can only be used in a modmail thread",
					flags: ["Ephemeral"],
				});
				return;
			}

			const modMail = await getActiveModMailByChannel(
				BigInt(interaction.channelId),
			);

			if (!modMail) {
				await interaction.followUp({
					content: "This command can only be used in a modmail thread",
					flags: ["Ephemeral"],
				});
				return;
			}
			const user = await safelyFetchUser(
				interaction.client,
				modMail.creatorId.toString(),
			);
			const ticketDetails = createModMailDetails(
				modMail,
				user ?? modMail.creatorId.toString(),
				true,
			) as {
				embed: EmbedBuilder;
				row: ActionRowBuilder<ButtonBuilder>;
			};

			await interaction.followUp({
				embeds: [ticketDetails.embed],
				components: [ticketDetails.row],
			});
		}
	},
};

const AssignSubCommand: ExecutableSubcommand = {
	type: ApplicationCommandOptionType.Subcommand,
	name: "assign",
	description: "Assign the current ticket to a moderator.",
	options: [
		{
			type: ApplicationCommandOptionType.User,
			name: "moderator",
			description: "The moderator to assign the ticket to",
			required: true,
		},
	],
	async handle(interaction) {
		await interaction.deferReply({
			flags: ["Ephemeral"],
		});

		if (!interaction.inGuild()) {
			await interaction.followUp({
				content: "This command can only be used in a guild",
				flags: ["Ephemeral"],
			});
			return;
		}

		// Check if user has moderator permissions
		const member = await getMemberFromInteraction(interaction);
		if (!member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
			await interaction.followUp({
				content: "You don't have permission to assign tickets",
				flags: ["Ephemeral"],
			});
			return;
		}

		if (!interaction.channel?.isThread()) {
			await interaction.followUp({
				content: "This command can only be used in a modmail thread",
				flags: ["Ephemeral"],
			});
			return;
		}

		const modMail = await getActiveModMailByChannel(
			BigInt(interaction.channelId),
		);

		if (!modMail) {
			await interaction.followUp({
				content: "This command can only be used in a modmail thread",
				flags: ["Ephemeral"],
			});
			return;
		}

		const targetUser = interaction.options.getUser("moderator", true);
		const targetMember = await interaction.guild?.members.fetch(targetUser.id);

		// Check if the target user has moderator permissions
		if (!targetMember?.permissions.has(PermissionFlagsBits.ManageMessages)) {
			await interaction.followUp({
				content: "The selected user doesn't have moderator permissions",
				flags: ["Ephemeral"],
			});
			return;
		}

		// Update the ticket assignment
		await modMail.update({
			assignedUserId: BigInt(targetUser.id),
		});

		// Send notification in the channel
		await interaction.channel.send({
			content: `🎯 Ticket has been assigned to ${targetUser} by ${interaction.user}`,
		});

		// Notify the user via DM
		try {
			const ticketCreator = await safelyFetchUser(
				interaction.client,
				modMail.creatorId.toString(),
			);
			if (ticketCreator) {
				const dmChannel = await ticketCreator.createDM();
				if (dmChannel?.isSendable()) {
					await dmChannel.send({
						content: `Your support ticket (#${modMail.id}) has been assigned to ${targetUser.displayName}. They will assist you shortly.`,
					});
				}
			}
		} catch {
			// Silently fail DM notification - not critical
		}

		await interaction.followUp({
			content: `✅ Successfully assigned ticket to ${targetUser.displayName}`,
			flags: ["Ephemeral"],
		});
	},
};

export const ModmailCommand: Command<ApplicationCommandType.ChatInput> = {
	name: "ticket",
	description: "Manage Tickets",
	type: ApplicationCommandType.ChatInput,
	options: [DetailsSubCommand, AssignSubCommand],
	handle() {},
};
