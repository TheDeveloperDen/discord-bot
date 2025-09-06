import { clearTimeout } from "node:timers";
import {
	type ActionRowBuilder,
	type ButtonBuilder,
	type ButtonInteraction,
	ChannelType,
	type Client,
	DiscordAPIError,
	type EmbedBuilder,
	type Interaction,
	type Message,
	type OmitPartialGroupDMChannel,
	PermissionFlagsBits,
	type StringSelectMenuInteraction,
	type UserSelectMenuInteraction,
} from "discord.js";
import { config } from "../../Config.js";
import { logger } from "../../logging.js";
import {
	ModMailTicket,
	ModMailTicketCategory,
} from "../../store/models/ModMailTicket.js";
import { mentionRoleById } from "../../util/role.js";
import { safelyFetchUser } from "../../util/users.js";
import type { EventListener } from "../module.js";
import {
	closeModMailTicketByModMail,
	createModMailDetails,
	createModMailInitializationEmbed,
	createModMailTicket,
	extractEmbedAndFilesFromMessageModMail,
	getActiveModMailByChannel,
	getActiveModMailByUser,
	handleModmailArchive,
	handleModmailAssign,
	handleModmailUserClose,
	handleModmailUserDetails,
	hasActiveModMailByUser,
	MODMAIL_ARCHIVE_ID,
	MODMAIL_ASSIGN_ID,
	MODMAIL_CATEGORY_SELECT_ID,
	MODMAIL_SUBMIT_ID,
	MODMAIL_USER_CLOSE_ID,
	MODMAIL_USER_DETAILS_ID,
} from "./modmail.js";

interface PendingModmailSelection {
	category: ModMailTicketCategory;
	timeout: NodeJS.Timeout;
}

const SELECTION_TIMEOUT_MS = 600 * 1000; // 10 minutes
const pendingModmailSelections = new Map<string, PendingModmailSelection>();

// Utility functions for better code organization
const isValidMessage = (message: Message) => {
	return message?.author && !message.author.bot && !message.author.system;
};

const isCommandMessage = (content: string) => {
	return content.startsWith("!") || content.startsWith("/");
};

const cleanupPendingSelection = (userId: string) => {
	const pending = pendingModmailSelections.get(userId);
	if (pending?.timeout) {
		clearTimeout(pending.timeout);
	}
	pendingModmailSelections.delete(userId);
};

const handleDMMessage = async (
	client: Client,
	message: OmitPartialGroupDMChannel<Message>,
) => {
	const modMail = await getActiveModMailByUser(BigInt(message.author.id));

	if (!modMail) {
		const initializationMessage = createModMailInitializationEmbed(
			message.author,
		);
		if (message.channel.isSendable())
			await message.channel.send({
				embeds: [initializationMessage.embed],
				components: initializationMessage.components,
			});
		return;
	}

	if (!modMail.threadId) {
		await closeModMailTicketByModMail(modMail);
		return;
	}

	try {
		const guild = await client.guilds.fetch(config.guildId);
		const thread = await guild.channels.fetch(modMail.threadId.toString());

		// Check if thread exists, is accessible, and is not archived
		if (!thread?.isThread()) {
			logger.warn(
				`Thread ${modMail.threadId} no longer exists or is not a thread`,
			);
			await closeModMailTicketByModMail(modMail);
			if (message.channel.isSendable()) {
				await message.channel.send({
					content:
						"Your ticket has been closed because the associated thread channel is no longer available.",
				});
			}
			return;
		}

		if (thread.archived) {
			logger.warn(`Thread ${modMail.threadId} is archived`);
			await closeModMailTicketByModMail(modMail);
			if (message.channel.isSendable()) {
				await message.channel.send({
					content:
						"Your ticket has been closed because the associated thread has been archived.",
				});
			}
			return;
		}

		if (!thread.isSendable()) {
			logger.warn(`Thread ${modMail.threadId} is not sendable`);
			await closeModMailTicketByModMail(modMail);
			if (message.channel.isSendable()) {
				await message.channel.send({
					content:
						"Your ticket has been closed because messages cannot be sent to the associated thread.",
				});
			}
			return;
		}

		const parsedMessage = extractEmbedAndFilesFromMessageModMail(
			message,
			message.author,
		);
		await thread.send({
			embeds: [parsedMessage.embed],
			files: parsedMessage.files,
		});
	} catch (error: unknown) {
		if (error instanceof DiscordAPIError) {
			// Check if the error is related to thread not existing or being inaccessible
			if (
				error.code === 10003 ||
				error.code === 50001 ||
				error.code === 50013
			) {
				logger.warn(
					`Thread ${modMail.threadId} is deleted or inaccessible, closing ticket`,
				);
				await closeModMailTicketByModMail(modMail);
				if (message.channel.isSendable()) {
					await message.channel.send({
						content:
							"Your ticket has been closed because the associated thread is no longer accessible.",
					});
				}
			} else {
				logger.error(
					`Error handling DM message from ${message.author.id}:`,
					error,
				);
			}
			return;
		}

		if (message.channel.isSendable())
			message.channel
				.send({
					content:
						"Sorry, there was an error processing your message. Please contact a member of staff manually.",
				})
				.catch(() => {
					logger.error(
						`Failed to send error message to user ${message.author.id}`,
					);
				});
	}
};

const handleThreadMessage = async (client: Client, message: Message<true>) => {
	try {
		const modMail = await getActiveModMailByChannel(BigInt(message.channelId));
		if (!modMail) return;

		// Check if the current thread is archived before processing
		if (message.channel.isThread() && message.channel.archived) {
			logger.warn(`Thread ${message.channelId} is archived, closing ticket`);
			await closeModMailTicketByModMail(modMail);
			// Can't send messages to archived threads, so just log and return
			return;
		}

		const user = await client.users.fetch(modMail.creatorId.toString());
		const dmChannel = await user.createDM();

		if (!dmChannel?.isSendable()) {
			await closeModMailTicketByModMail(modMail);
			if (message.channel.isSendable()) {
				await message.channel.send({
					content:
						"This ticket was closed because the DM channel is no longer accessible.",
				});
			}
			return;
		}

		const parsedMessage = extractEmbedAndFilesFromMessageModMail(
			message,
			message.author,
		);

		// Send to thread first to show it was processed (only if thread is sendable)
		if (message.channel.isSendable()) {
			await message.channel.send({
				embeds: [parsedMessage.embed],
			});
		}

		// Then send to DM
		await dmChannel.send({
			embeds: [parsedMessage.embed],
			files: parsedMessage.files,
		});

		// Delete original message to keep thread clean
		await message.delete().catch(() => {
			logger.warn(`Failed to delete message ${message.id} in thread`);
		});
	} catch (error: unknown) {
		if (error instanceof DiscordAPIError) {
			logger.error(`Discord API Error: ${error.code} - ${error.message}`);
			// Check if the error is related to thread being deleted or archived
			if (
				error.code === 10003 ||
				error.code === 50001 ||
				error.code === 50013
			) {
				logger.warn(
					`Thread ${message.channelId} is deleted or inaccessible, closing ticket`,
				);
				const modMail = await getActiveModMailByChannel(
					BigInt(message.channelId),
				);
				if (modMail) {
					await closeModMailTicketByModMail(modMail);
				}
			} else {
				logger.error(`Error handling thread message ${message.id}:`, error);
			}

			return;
		}

		try {
			if (message.channel.isSendable()) {
				await message.channel.send({
					content: `An error occurred while processing the message. Message link: ${message.url}`,
				});
			}
		} catch (innerError) {
			logger.error(`Failed to send error message in thread:`, innerError);
		}
	}
};

const handleModmailAssignSelect = async (
	interaction: UserSelectMenuInteraction,
) => {
	await interaction.deferReply({ flags: ["Ephemeral"] });

	try {
		if (!interaction.inGuild()) {
			await interaction.followUp({
				content: "This command can only be used in a guild.",
				flags: ["Ephemeral"],
			});
			return;
		}

		// Check if the current thread is still accessible
		if (interaction.channel?.isThread()) {
			if (interaction.channel.archived) {
				await interaction.followUp({
					content:
						"This thread has been archived and the ticket is no longer active.",
					flags: ["Ephemeral"],
				});
				return;
			}
		}

		// Extract ticket ID from custom ID
		const ticketId = interaction.customId.split("-").pop();
		if (!ticketId) {
			await interaction.followUp({
				content: "Invalid ticket ID.",
				flags: ["Ephemeral"],
			});
			return;
		}
		const modMail = await ModMailTicket.findOne({
			where: {
				id: BigInt(ticketId),
			},
		});

		if (!modMail) {
			await interaction.followUp({
				content: "Ticket not found.",
				flags: ["Ephemeral"],
			});
			return;
		}

		const targetUserId = interaction.values[0];
		const targetMember = await interaction.guild?.members.fetch(targetUserId);

		// Check if the target user has moderator permissions
		if (!targetMember?.permissions.has(PermissionFlagsBits.ManageMessages)) {
			await interaction.followUp({
				content: "The selected user doesn't have moderator permissions.",
				flags: ["Ephemeral"],
			});
			return;
		}

		// Update the ticket assignment
		await modMail.update({
			assignedUserId: BigInt(targetUserId),
		});

		// Send notification in the channel (with error handling for deleted/archived threads)
		if (interaction.channel?.isSendable()) {
			try {
				await interaction.channel.send({
					content: `🎯 Ticket has been assigned to <@${targetUserId}> by ${interaction.user}`,
				});
			} catch (error) {
				logger.warn("Failed to send assignment notification to thread:", error);
				// Thread might be deleted or archived, but assignment was successful
			}
		}

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
						content: `Your support ticket (#${modMail.id}) has been assigned to ${targetMember.displayName}. They will assist you shortly.`,
					});
				}
			}
		} catch (error) {
			logger.warn("Failed to send DM notification to ticket creator:", error);
		}

		await interaction.followUp({
			content: `✅ Successfully assigned ticket to ${targetMember.displayName}`,
			flags: ["Ephemeral"],
		});
	} catch (error) {
		logger.error("Failed to assign ticket:", error);
		await interaction.followUp({
			content: "An error occurred while assigning the ticket.",
			flags: ["Ephemeral"],
		});
	}
};

const handleModmailSubmit = async (
	client: Client,
	interaction: ButtonInteraction,
) => {
	await interaction.deferUpdate();

	const userId = interaction.user.id;

	if (await hasActiveModMailByUser(BigInt(userId))) {
		await interaction.message.delete().catch(() => {});
		await interaction.followUp({
			content: "You already have an open ticket",
			flags: ["Ephemeral"],
		});
		return;
	}

	const userConfig = pendingModmailSelections.get(userId);
	const category = userConfig?.category ?? ModMailTicketCategory.QUESTION;

	// Clean up pending selection
	cleanupPendingSelection(userId);

	try {
		const guild = await client.guilds.fetch(config.guildId);
		const channel = await guild.channels.fetch(config.modmail.channel);

		if (!channel) {
			await interaction.followUp({
				content: "Modmail channel not found. Please contact an administrator.",
				flags: ["Ephemeral"],
			});
			logger.error("Modmail channel not found");
			return;
		}

		if (!channel.isTextBased() || channel.type !== ChannelType.GuildText) {
			await interaction.followUp({
				content:
					"Modmail channel configuration error. Please contact an administrator.",
				flags: ["Ephemeral"],
			});
			logger.error("Modmail channel is not a text channel");
			return;
		}

		const thread = await channel.threads.create({
			name: `${category} - ${interaction.user.tag}`,
			reason: `Modmail thread created by ${interaction.user.tag}`,
			type: ChannelType.PublicThread,
		});

		const ticket = await createModMailTicket(
			BigInt(userId),
			BigInt(thread.id),
			category,
		);

		const ticketDetails = createModMailDetails(
			ticket,
			interaction.user,
			true,
		) as {
			embed: EmbedBuilder;
			row: ActionRowBuilder<ButtonBuilder>;
		};

		await thread.send({
			content: `A new ticket has been created! ${config.modmail.pingRole ? mentionRoleById(config.modmail.pingRole) : ""}`,
			embeds: [ticketDetails.embed],
			components: [ticketDetails.row],
		});

		if (interaction.channel?.isSendable()) {
			const userTicketDetails = createModMailDetails(
				ticket,
				interaction.user,
				false,
				true,
			) as {
				embed: EmbedBuilder;
				row: ActionRowBuilder<ButtonBuilder>;
			};

			await interaction.channel.send({
				content:
					"Your ticket has been created successfully! A member of staff will follow up soon.",
				embeds: [userTicketDetails.embed],
				components: [userTicketDetails.row],
			});
		}

		await interaction.message.delete().catch(() => {
			logger.warn(`Failed to delete initialization message for user ${userId}`);
		});
	} catch (error) {
		logger.error(`Error creating modmail ticket for user ${userId}:`, error);
		await interaction.followUp({
			content:
				"An error occurred while creating your ticket. Please try again or contact an administrator.",
			flags: ["Ephemeral"],
		});
	}
};

const handleCategorySelect = async (
	interaction: StringSelectMenuInteraction,
) => {
	const category = interaction.values[0] as ModMailTicketCategory;
	const userId = interaction.user.id;

	// Clean up existing timeout if any
	cleanupPendingSelection(userId);

	const timeout = setTimeout(() => {
		pendingModmailSelections.delete(userId);
	}, SELECTION_TIMEOUT_MS);

	pendingModmailSelections.set(userId, {
		category,
		timeout,
	});

	await interaction.deferUpdate();
};

export const ModMailListener: EventListener[] = [
	{
		async messageCreate(client, message) {
			if (!isValidMessage(message)) return;

			if (message.channel.isDMBased()) {
				await handleDMMessage(client, message);
			} else if (
				message.inGuild() &&
				message.channel.isThread() &&
				!isCommandMessage(message.content)
			) {
				await handleThreadMessage(client, message);
			}
		},

		async interactionCreate(client, interaction: Interaction) {
			if (
				!interaction.isButton() &&
				!interaction.isStringSelectMenu() &&
				!interaction.isUserSelectMenu()
			)
				return;

			try {
				if (
					interaction.customId === MODMAIL_SUBMIT_ID &&
					interaction.isButton()
				) {
					await handleModmailSubmit(client, interaction);
				} else if (
					interaction.isStringSelectMenu() &&
					interaction.customId === MODMAIL_CATEGORY_SELECT_ID
				) {
					await handleCategorySelect(interaction);
				} else if (
					interaction.isButton() &&
					interaction.customId === MODMAIL_ARCHIVE_ID
				) {
					await handleModmailArchive(interaction);
				} else if (
					interaction.isButton() &&
					interaction.customId === MODMAIL_ASSIGN_ID
				) {
					await handleModmailAssign(interaction);
				} else if (
					interaction.isUserSelectMenu() &&
					interaction.customId.startsWith("modmail-assign-select-")
				) {
					await handleModmailAssignSelect(interaction);
				} else if (
					interaction.customId === MODMAIL_USER_DETAILS_ID &&
					interaction.isButton()
				) {
					await handleModmailUserDetails(interaction);
				} else if (
					interaction.customId === MODMAIL_USER_CLOSE_ID &&
					interaction.isButton()
				) {
					await handleModmailUserClose(interaction);
				}
			} catch (error) {
				logger.error(`Error handling interaction ${interaction.id}:`, error);

				const errorMessage =
					"An unexpected error occurred. Please try again or contact support.";

				if (interaction.deferred || interaction.replied) {
					await interaction
						.followUp({
							content: errorMessage,
							flags: ["Ephemeral"],
						})
						.catch(() => {});
				} else {
					await interaction
						.reply({
							content: errorMessage,
							flags: ["Ephemeral"],
						})
						.catch(() => {});
				}
			}
		},
	},
];
