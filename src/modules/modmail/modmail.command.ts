import {
	type ActionRowBuilder,
	ApplicationCommandOptionType,
	ApplicationCommandType,
	type ButtonBuilder,
	type EmbedBuilder,
	PermissionFlagsBits,
} from "discord.js";
import type { Command, ExecutableSubcommand } from "djs-slash-helper";
import { config } from "../../Config.js";
import { logger } from "../../logging.js";
import { getMemberFromInteraction } from "../../util/member.js";
import { safelyFetchUser } from "../../util/users.js";
import {
	closeModMailTicketByModMail,
	createModMailDetails,
	getActiveModMailByChannel,
	getActiveModMailByUser,
} from "./modmail.js";

const DetailsSubCommand: ExecutableSubcommand = {
	type: ApplicationCommandOptionType.Subcommand,
	name: "details",
	description: "Get details about the current thread.",
	async handle(interaction) {
		await interaction.deferReply({
			flags: ["Ephemeral"],
		});

		// Handle DM usage
		if (!interaction.inGuild()) {
			const modMail = await getActiveModMailByUser(BigInt(interaction.user.id));
			if (!modMail) {
				await interaction.followUp({
					content: "You don't have an active ticket.",
					flags: ["Ephemeral"],
				});
				return;
			}

			const ticketDetails = createModMailDetails(
				modMail,
				interaction.user,
				false,
				true,
			) as {
				embed: EmbedBuilder;
				row: ActionRowBuilder<ButtonBuilder>;
			};

			await interaction.followUp({
				embeds: [ticketDetails.embed],
				components: [ticketDetails.row],
				flags: ["Ephemeral"],
			});
			return;
		}

		// Handle guild usage (existing logic)
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
	},
};

const CloseSubCommand: ExecutableSubcommand = {
	type: ApplicationCommandOptionType.Subcommand,
	name: "close",
	description: "Close your ticket or the current modmail thread.",
	async handle(interaction) {
		await interaction.deferReply({
			flags: ["Ephemeral"],
		});

		// Handle DM usage - user closing their own ticket
		if (!interaction.inGuild()) {
			const modMail = await getActiveModMailByUser(BigInt(interaction.user.id));
			if (!modMail) {
				await interaction.followUp({
					content: "You don't have an active ticket.",
					flags: ["Ephemeral"],
				});
				return;
			}

			// Close the ticket
			await closeModMailTicketByModMail(modMail);

			// Notify the thread if it exists
			try {
				if (modMail.threadId) {
					const guild = await interaction.client.guilds.fetch(config.guildId);
					const thread = await guild.channels.fetch(
						modMail.threadId.toString(),
					);

					if (thread?.isThread() && thread.isSendable()) {
						await thread.send({
							content: `🔒 Ticket has been closed by the user (${interaction.user.displayName}).`,
						});
					}
				}
			} catch (error) {
				logger.warn(
					"Failed to notify thread about user closing ticket:",
					error,
				);
			}

			await interaction.followUp({
				content: "✅ Your ticket has been closed. Thank you for contacting us!",
				flags: ["Ephemeral"],
			});
			return;
		}

		// Handle guild usage - moderator closing ticket
		const member = await getMemberFromInteraction(interaction);
		if (!member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
			await interaction.followUp({
				content: "You don't have permission to close tickets",
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

		// Close the ticket
		await closeModMailTicketByModMail(modMail);

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
						content: `Your support ticket (#${modMail.id}) has been closed by ${interaction.user.displayName}. Thank you for contacting us!`,
					});
				}
			}
		} catch {
			// Silently fail DM notification - not critical
		}

		// Send notification in the channel
		await interaction.channel.send({
			content: `🔒 Ticket has been closed by ${interaction.user}`,
		});

		await interaction.followUp({
			content: `✅ Successfully closed ticket`,
			flags: ["Ephemeral"],
		});
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
	options: [DetailsSubCommand, AssignSubCommand, CloseSubCommand],
	handle() {},
};
