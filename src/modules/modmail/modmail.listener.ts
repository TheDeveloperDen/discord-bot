import { clearTimeout } from "node:timers";
import {
	ActionRowBuilder,
	type ButtonBuilder,
	type ButtonInteraction,
	ChannelType,
	type Client,
	DiscordAPIError,
	type EmbedBuilder,
	type Interaction,
	type Message,
	ModalBuilder,
	type ModalSubmitInteraction,
	type OmitPartialGroupDMChannel,
	PermissionFlagsBits,
	type StringSelectMenuInteraction,
	TextInputBuilder,
	TextInputStyle,
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
	createModMailNoteEmbed,
	createModMailTicket,
	extractContentsFromMessage,
	extractEmbedAndFilesFromMessageModMail,
	extractNoteIdFromMessage,
	getActiveModMailByChannel,
	getActiveModMailByUser,
	getModMailNoteById,
	handleModmailAddNote,
	handleModmailArchive,
	handleModmailAssign,
	handleModmailShowNotes,
	handleModmailUserClose,
	handleModmailUserDetails,
	hasActiveModMailByUser,
	MODMAIL_ADD_NOTE_ID,
	MODMAIL_ARCHIVE_ID,
	MODMAIL_ASSIGN_ID,
	MODMAIL_CATEGORY_SELECT_ID,
	MODMAIL_DELETE_NOTE_ID,
	MODMAIL_EDIT_NOTE_ID,
	MODMAIL_LIST_NOTES_ID,
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
		const threadChannel = await guild.channels.fetch(config.modmail.channel);
		if (!threadChannel || threadChannel.type !== ChannelType.GuildText) {
			logger.warn(`Modmail channel ${config.modmail.channel} not found`);
			return;
		}
		const thread = await threadChannel.threads.fetch(
			modMail.threadId.toString(),
		);

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
				id: ticketId,
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
		if (!thread.joined) await thread.join();
		logger.debug(
			"Created modmail thread for user %s with id %s",
			interaction.user.id,
			thread.id,
		);

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
		try {
			if (interaction.channel?.isSendable()) {
				interaction.channel
					.send({
						content: `The selection process for your ticket has timed out. Please try again.`,
					})
					.catch(() => {});
			}
		} catch {}
	}, SELECTION_TIMEOUT_MS);

	pendingModmailSelections.set(userId, {
		category,
		timeout,
	});

	await interaction.deferUpdate();
};

const handleModmailNoteDelete = async (interaction: ButtonInteraction) => {
	await interaction.deferUpdate();
	if (!interaction.inGuild()) return;
	const message = interaction.message as Message<true>;
	const noteId = await extractNoteIdFromMessage(message);

	if (!noteId) {
		await interaction.followUp({
			content: "Invalid Message you are trying to fake as Note.",
			flags: ["Ephemeral"],
		});
		return;
	} else {
		const note = await getModMailNoteById(noteId);
		const modLogChannel = await interaction.guild?.channels.fetch(
			config.channels.modLog,
		);
		if (modLogChannel?.isSendable()) {
			const contents = await extractContentsFromMessage(message);
			modLogChannel
				.send({
					content: `**Note deleted by ${interaction.user.tag}**\n\nContents: ${contents.content}`,
				})
				.catch(() => {
					console.log("Failed to send note deletion to mod log channel");
				});
			await note?.destroy();
			message.delete().catch(() => {});
			await interaction.followUp({
				content: "Note deleted.",
				flags: ["Ephemeral"],
			});
		}
	}
};

const handleModmailNoteEdit = async (interaction: ButtonInteraction) => {
	if (!interaction.inGuild()) return;
	const message = interaction.message as Message<true>;
	const noteId = await extractNoteIdFromMessage(message);

	if (!noteId) {
		await interaction.reply({
			content: "Invalid Message you are trying to fake as Note.",
			flags: ["Ephemeral"],
		});
		return;
	}

	const note = await getModMailNoteById(noteId);
	if (!note) {
		await interaction.reply({
			content: "Note not found.",
			flags: ["Ephemeral"],
		});
		return;
	}

	// Create modal for editing the note
	const modal = new ModalBuilder()
		.setTitle("Edit Note")
		.setCustomId(`modmail-edit-note-${noteId}`);

	const contentField = new TextInputBuilder()
		.setCustomId("noteContentField")
		.setLabel("Note Content")
		.setStyle(TextInputStyle.Paragraph)
		.setValue(note.content)
		.setRequired(true);

	modal.addComponents(
		new ActionRowBuilder<TextInputBuilder>().addComponents(contentField),
	);

	await interaction.showModal(modal);
};

const handleModmailNoteEditModal = async (
	interaction: ModalSubmitInteraction,
) => {
	await interaction.deferReply({ flags: ["Ephemeral"] });

	if (!interaction.inGuild()) return;

	// Extract note ID from custom ID
	const noteId = interaction.customId.split("-").pop();
	if (!noteId) {
		await interaction.followUp({
			content: "Invalid note ID.",
			flags: ["Ephemeral"],
		});
		return;
	}

	const note = await getModMailNoteById(BigInt(noteId));
	if (!note) {
		await interaction.followUp({
			content: "Note not found.",
			flags: ["Ephemeral"],
		});
		return;
	}

	const newContent = interaction.fields.getTextInputValue("noteContentField");

	// Update the note
	await note.update({
		content: newContent,
		updatedBy: BigInt(interaction.user.id),
		contentUpdatedAt: new Date(),
	});

	// Update the message embed
	const originalMessage = interaction.message;
	if (originalMessage?.embeds[0]) {
		const updatedEmbed = await createModMailNoteEmbed(interaction.client, note);
		// Add updated information
		await originalMessage.edit({
			embeds: [updatedEmbed],
			components: originalMessage.components,
		});
	}

	// Log the edit to mod log
	const modLogChannel = await interaction.guild?.channels.fetch(
		config.channels.modLog,
	);
	if (modLogChannel?.isSendable()) {
		modLogChannel
			.send({
				content: `**Note edited by ${interaction.user.tag}**\n\nOriginal: ${note.content}\nNew: ${newContent}`,
			})
			.catch(() => {
				console.log("Failed to send note edit to mod log channel");
			});
	}

	await interaction.followUp({
		content: "Note updated successfully.",
		flags: ["Ephemeral"],
	});
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
				!interaction.isUserSelectMenu() &&
				!interaction.isModalSubmit()
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
					interaction.isButton() &&
					interaction.customId === MODMAIL_ADD_NOTE_ID
				) {
					await handleModmailAddNote(interaction);
				} else if (
					interaction.isButton() &&
					interaction.customId === MODMAIL_EDIT_NOTE_ID
				) {
					await handleModmailNoteEdit(interaction);
				} else if (
					interaction.isModalSubmit() &&
					interaction.customId.startsWith("modmail-edit-note-")
				) {
					await handleModmailNoteEditModal(interaction);
				} else if (
					interaction.isButton() &&
					interaction.customId === MODMAIL_LIST_NOTES_ID
				) {
					await handleModmailShowNotes(interaction);
				} else if (
					interaction.isButton() &&
					interaction.customId === MODMAIL_DELETE_NOTE_ID
				) {
					await handleModmailNoteDelete(interaction);
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
