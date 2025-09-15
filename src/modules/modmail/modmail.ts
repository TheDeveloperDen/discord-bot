import { readFileSync } from "node:fs";
import type { MessageActionRowComponentBuilder } from "@discordjs/builders";
import {
	ActionRowBuilder,
	type AnyThreadChannel,
	AttachmentBuilder,
	type AttachmentPayload,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	type Client,
	type EmbedAuthorData,
	type EmbedBuilder,
	type GuildMember,
	type JSONEncodable,
	type Message,
	type PartialGuildMember,
	PermissionFlagsBits,
	type SelectMenuComponentOptionData,
	StringSelectMenuBuilder,
	type User,
	UserSelectMenuBuilder,
} from "discord.js";
import Handlebars from "handlebars";
import { config } from "../../Config.js";
import { logger } from "../../logging.js";
import { ModMailNote } from "../../store/models/ModMailNote.js";
import {
	ModMailTicket,
	ModMailTicketCategory,
	ModMailTicketStatus,
} from "../../store/models/ModMailTicket.js";
import { createStandardEmbed } from "../../util/embeds.js";
import { getMemberFromInteraction } from "../../util/member.js";
import { fetchAllMessagesWithRetry } from "../../util/message.js";
import {
	DiscordTimestampStyle,
	formatDiscordTimestamp,
} from "../../util/time.js"; // =============================================
import { actualMentionById, safelyFetchUser } from "../../util/users.js";

// =============================================
// CONSTANTS & CONFIGURATION
// =============================================

/** Custom IDs for Discord components */
export const MODMAIL_SUBMIT_ID = "modmail-submit";
export const MODMAIL_CATEGORY_SELECT_ID = "modmail-category-select";
export const MODMAIL_ARCHIVE_ID = "modmail-archive";
export const MODMAIL_ASSIGN_ID = "modmail-assign";
export const MODMAIL_USER_DETAILS_ID = "modmail-user-details";
export const MODMAIL_USER_CLOSE_ID = "modmail-user-close";
export const MODMAIL_ADD_NOTE_ID = "modmail-add-note";
export const MODMAIL_LIST_NOTES_ID = "modmail-list-notes";
export const MODMAIL_DELETE_NOTE_ID = "modmail-delete-note";
export const MODMAIL_EDIT_NOTE_ID = "modmail-edit-note";

export const MODMAIL_NOTE_FIELD_NAME = "Note ID";
/** Category selection options for modmail tickets */
const modMailCategorySelections: SelectMenuComponentOptionData[] = [
	{
		label: "Question",
		value: ModMailTicketCategory.QUESTION,
		default: true,
		description: "Questions about the server or a project",
		emoji: "❓",
	},
	{
		label: "Bug Report",
		value: ModMailTicketCategory.BUG,
		description: "Report a bug in the server or a project",
		emoji: "🐛",
	},
	{
		label: "Suggestion",
		value: ModMailTicketCategory.SUGGESTION,
		description: "Make a suggestion for the server or a project",
		emoji: "💡",
	},
	{
		label: "Other",
		value: ModMailTicketCategory.OTHER,
		description: "Any other category",
		emoji: "🗨️",
	},
];

// =============================================
// DATABASE OPERATIONS
// =============================================

/**
 * Retrieves an active modmail ticket for a specific user
 * @param userId The ID of the user to search for
 * @returns The active modmail ticket or null if none exists
 */
export async function getActiveModMailByUser(userId: bigint) {
	return await ModMailTicket.findOne({
		where: {
			creatorId: userId,
			status: ModMailTicketStatus.OPEN,
		},
	});
}

/**
 * Checks if a user has an active modmail ticket
 * @param userId The ID of the user to check
 * @returns True if the user has an active ticket, false otherwise
 */
export async function hasActiveModMailByUser(userId: bigint) {
	return (
		(await ModMailTicket.count({
			where: {
				creatorId: userId,
				status: ModMailTicketStatus.OPEN,
			},
		})) > 0
	);
}

/**
 * Retrieves an active modmail ticket for a specific thread/channel
 * @param threadId The ID of the thread to search for
 * @returns The active modmail ticket or null if none exists
 */
export async function getActiveModMailByChannel(threadId: bigint) {
	return await ModMailTicket.findOne({
		where: {
			threadId: threadId,
			status: ModMailTicketStatus.OPEN,
		},
	});
}

/**
 * Creates a new modmail ticket in the database
 * @param creatorId The ID of the user creating the ticket
 * @param threadId The ID of the thread for this ticket
 * @param category The category of the ticket (defaults to QUESTION)
 * @returns The created modmail ticket
 */
export async function createModMailTicket(
	creatorId: bigint,
	threadId: bigint,
	category: ModMailTicketCategory = ModMailTicketCategory.QUESTION,
) {
	return await ModMailTicket.create({
		creatorId: creatorId,
		threadId: threadId,
		category: category,
		status: ModMailTicketStatus.OPEN,
	});
}

/**
 * Closes a modmail ticket by thread ID
 * @param threadId The ID of the thread to close
 * @returns The updated ticket or undefined if not found
 */
export async function closeModMailTicketByThreadId(threadId: bigint) {
	const ticket = await ModMailTicket.findOne({
		where: {
			threadId: threadId,
		},
	});
	if (ticket == null) {
		return;
	}
	return await ticket.update({
		status: ModMailTicketStatus.ARCHIVED,
	});
}

/**
 * Closes a modmail ticket by ticket instance
 * @param ticket The modmail ticket to close
 * @returns The updated ticket
 */
export async function closeModMailTicketByModMail(ticket: ModMailTicket) {
	return await ticket.update({
		status: ModMailTicketStatus.ARCHIVED,
	});
}

// =============================================
// ARCHIVE SYSTEM
// =============================================

/**
 * Creates an HTML archive from a Discord thread and modmail ticket
 * @param thread The Discord thread to archive
 * @param modMailTicket The associated modmail ticket
 * @returns Archive result with success status and content
 */
export async function createArchiveFromThread(
	thread: AnyThreadChannel,
	modMailTicket: ModMailTicket,
) {
	try {
		const assignedModerator = !modMailTicket.assignedUserId
			? null
			: await thread.guild.members.fetch(
					modMailTicket.assignedUserId.toString(),
				);
		const messages = await fetchAllMessagesWithRetry(
			thread,
			3,
			50000,
			(message) => {
				return (
					message.author.bot &&
					message.author.id === thread.client.user.id &&
					message.embeds.length === 1 &&
					!message.embeds[0].title
				);
			},
		); // Max 3 retries, up to 50k messages

		logger.info(`Processing ${messages.size} messages for archive...`);

		// Convert messages to template data
		const messageData = await Promise.all(
			messages.map(async (message) => {
				const attachments = message.attachments.map((attachment) => ({
					name: attachment.name || "Unknown",
					url: attachment.url,
					size: attachment.size,
					contentType: attachment.contentType || "unknown",
					isImage: attachment.contentType?.startsWith("image/") || false,
				}));
				const embed = message.embeds[0];
				const messageContent = embed.description ?? "Unknown";

				const author = embed.author as EmbedAuthorData;

				return {
					id: message.id,
					content: messageContent,
					createdAt: message.createdAt.toLocaleString(),
					author: {
						url: author.url,
						displayName: author.name,
						avatarURL: author.iconURL,
					},
					attachments: attachments,
				};
			}),
		);

		// Sort messages by creation time (oldest first)
		messageData.sort(
			(a, b) =>
				new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
		);

		logger.debug(`Sorted ${messageData.length} messages chronologically`);

		// Prepare template data
		const templateData = {
			threadName: thread.name || "Unnamed Thread",
			threadId: thread.id,
			createdAt: thread.createdAt?.toLocaleString() || "Unknown",
			archivedAt: new Date().toLocaleString(),
			messageCount: messageData.length,
			messages: messageData,
			generatedAt: new Date().toLocaleString(),
			ticket: modMailTicket,
			assignedTo: !assignedModerator
				? "Unassigned"
				: (assignedModerator.displayName ?? assignedModerator.user.username),
		};

		// Load and compile the template
		const templatePath = `${process.cwd()}/src/modules/modmail/template/modmail-archive.html`;
		const templateContent = readFileSync(templatePath, "utf-8");
		const template = Handlebars.compile(templateContent);

		// Generate HTML
		logger.debug("Generating HTML archive...");
		const html = template(templateData, {
			allowedProtoProperties: {
				category: true,
				avatarURL: true,
				displayName: true,
				url: true,
			},
		});

		logger.info(
			`Successfully created archive with ${messageData.length} messages`,
		);

		return {
			success: true,
			content: html,
			messageCount: messageData.length,
		};
	} catch (error) {
		logger.error("Failed to create thread archive:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

// =============================================
// UI COMPONENTS & EMBEDS
// =============================================

/**
 * Creates the initial modmail setup embed with category selection
 * @param user The user initiating the modmail
 * @returns Embed and components for modmail initialization
 */
export function createModMailInitializationEmbed(user: User) {
	const embed = createStandardEmbed(user)
		.setTitle("Modmail")
		.setDescription(
			"Welcome to the Modmail system! Please select a category below to get started.",
		);

	const categorySelect = new StringSelectMenuBuilder()
		.setCustomId(MODMAIL_CATEGORY_SELECT_ID)
		.setPlaceholder("Select a category")
		.setMaxValues(1)
		.setMinValues(1)
		.addOptions(modMailCategorySelections);

	const categorySelectRow =
		new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
			categorySelect,
		);

	const submitButton = new ButtonBuilder()
		.setCustomId(MODMAIL_SUBMIT_ID)
		.setLabel("Submit")
		.setStyle(ButtonStyle.Primary);

	const actionRow =
		new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
			submitButton,
		);

	return {
		embed: embed,
		components: [categorySelectRow, actionRow],
	};
}

/**
 * Creates detailed ticket information embed with action buttons
 * @param modMailTicket The ticket to display details for
 * @param user User or username associated with the ticket
 * @param moderator Whether this is for a moderator view
 * @param forUser Whether this is for the user who created the ticket
 * @returns Embed and action row with appropriate buttons
 */
export function createModMailDetails(
	modMailTicket: ModMailTicket,
	user: User | string,
	moderator: boolean | null = null,
	forUser: boolean = false,
) {
	const isString = typeof user === "string";
	const embed = isString ? createStandardEmbed() : createStandardEmbed(user);
	embed.setTitle(
		`Modmail Ticket #${modMailTicket.id} -  ${isString ? user : user.displayName}`,
	);
	embed.addFields([
		{
			name: "Category",
			value: modMailTicket.category,
		},
	]);

	if (!moderator && !forUser) {
		return { embed: embed, row: null };
	}

	// Add moderator assignment information
	if (modMailTicket.assignedUserId) {
		embed.addFields({
			name: "Assigned Moderator",
			value: actualMentionById(modMailTicket.assignedUserId),
			inline: true,
		});
	} else {
		embed.addFields({
			name: "Assigned Moderator",
			value: "Unassigned",
			inline: true,
		});
	}

	embed.addFields({
		name: "Status",
		value: modMailTicket.status,
		inline: true,
	});

	if (forUser) {
		// Show user-specific buttons
		const detailsButton = new ButtonBuilder()
			.setStyle(ButtonStyle.Secondary)
			.setLabel("Show Details")
			.setCustomId(MODMAIL_USER_DETAILS_ID);

		const closeButton = new ButtonBuilder()
			.setStyle(ButtonStyle.Danger)
			.setLabel("Close Ticket")
			.setCustomId(MODMAIL_USER_CLOSE_ID);

		const actionRow =
			new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents([
				detailsButton,
				closeButton,
			]);

		return { embed: embed, row: actionRow };
	}

	// Moderator action buttons
	const archiveButton = new ButtonBuilder()
		.setStyle(ButtonStyle.Danger)
		.setLabel("Archive")
		.setCustomId(MODMAIL_ARCHIVE_ID);

	const assignButton = new ButtonBuilder()
		.setStyle(ButtonStyle.Primary)
		.setLabel("Assign")
		.setCustomId(MODMAIL_ASSIGN_ID);

	const addNoteButton = new ButtonBuilder()
		.setStyle(ButtonStyle.Secondary)
		.setLabel("Add Note")
		.setCustomId(MODMAIL_ADD_NOTE_ID);

	const listNotesButton = new ButtonBuilder()
		.setStyle(ButtonStyle.Secondary)
		.setLabel("List Notes")
		.setCustomId(MODMAIL_LIST_NOTES_ID);

	const actionRow =
		new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents([
			archiveButton,
			assignButton,
			addNoteButton,
			listNotesButton,
		]);
	return { embed: embed, row: actionRow };
}

/**
 * Extracts embed and files from a Discord message for modmail display
 * @param message The Discord message to extract from
 * @param user The user who sent the message
 * @returns Embed and files for modmail thread
 */
export function extractEmbedAndFilesFromMessageModMail(
	message: Message,
	user: GuildMember | User,
) {
	const embed = createStandardEmbed(user)
		.setColor("Blurple")
		.setAuthor({
			name: user.displayName,
			iconURL: user.displayAvatarURL(),
			url: `https://discord.com/users/${user.id}`,
		})
		.setDescription(message.content.length > 0 ? message.content : null);
	const files: AttachmentBuilder[] = message.attachments.map((attachment) =>
		AttachmentBuilder.from(
			attachment.toJSON() as JSONEncodable<AttachmentPayload>,
		),
	);

	return {
		embed: embed,
		files: files.length > 0 ? files : undefined,
	};
}

// =============================================
// NOTES SYSTEM
// =============================================

export async function getModMailNoteById(
	id: bigint,
): Promise<ModMailNote | null> {
	return ModMailNote.findOne({
		where: {
			id: id,
		},
	});
}

export async function createModMailNoteEmbed(
	client: Client,
	modmailNote: ModMailNote,
) {
	const author = await safelyFetchUser(client, modmailNote.authorId.toString());
	const authorName = author?.displayName ?? "Unknown User";

	const updaterUser = modmailNote.updatedBy
		? await safelyFetchUser(client, modmailNote.updatedBy.toString())
		: null;
	const updaterName = updaterUser?.displayName;

	const embed = createStandardEmbed(author ?? undefined)
		.setTitle("Mod Note")
		.setDescription(modmailNote.content)
		.setAuthor({
			name: `#${modmailNote.id} | Note by ${authorName}`,
			iconURL: author?.displayAvatarURL(),
		})
		.addFields({
			name: MODMAIL_NOTE_FIELD_NAME,
			value: modmailNote.id.toString(),
			inline: true,
		})
		.setTimestamp(modmailNote.createdAt);

	if (updaterName !== undefined) {
		embed.addFields({
			name: `Last Updated by ${updaterName}`,
			value: formatDiscordTimestamp(
				modmailNote.contentUpdatedAt as Date,
				DiscordTimestampStyle.RELATIVE,
			),
			inline: true,
		});
	}

	return embed;
}

/**
 * Generates an embed displaying all notes for a modmail ticket
 * @param client The Discord client
 * @param modMail The modmail ticket
 * @param notes Array of notes to display
 * @param user The user requesting the notes (optional)
 * @returns Embed containing all notes information
 */
export async function generateEmbedsForModMailNotes(
	client: Client,
	modMail: ModMailTicket,
	notes: ModMailNote[],
	user?: GuildMember | PartialGuildMember | User,
): Promise<{ embed: EmbedBuilder }> {
	const embed = createStandardEmbed(user)
		.setTitle(`Notes for Ticket #${modMail.id}`)
		.setDescription(`Found ${notes.length} note(s):`);

	for (const note of notes) {
		const author = await safelyFetchUser(client, note.authorId.toString());
		const authorName = author?.displayName ?? "Unknown User";

		const updaterUser = note.updatedBy
			? await safelyFetchUser(client, note.updatedBy.toString())
			: null;

		const updaterName = updaterUser?.displayName;

		embed.addFields({
			name: `#${note.id} | Note by ${authorName} ${
				updaterName !== undefined
					? `| Last updated by ${updaterName} ${formatDiscordTimestamp(
							note.contentUpdatedAt as Date,
							DiscordTimestampStyle.RELATIVE,
						)}`
					: ""
			}`,
			value: note.content.substring(0, 1024), // Because Embed Fields have a maximum of 1024 chars
			inline: false,
		});
	}
	return {
		embed: embed,
	};
}

/**
 * Extracts the content and embed from a given message.
 *
 * @param {Message<true>} message - The message object from which to extract the content and embed.
 * @return {Promise<{ content: string, embed: object | undefined }>} An object containing the extracted content and the embed, if present.
 */
export async function extractContentsFromMessage(
	message: Message<true>,
): Promise<{ content: string; embed: object | undefined }> {
	const embed = message.embeds[0];
	const content = embed?.description || message.content;
	return { content, embed };
}

export async function extractNoteIdFromMessage(
	message: Message<true>,
): Promise<bigint | undefined> {
	const embed = message.embeds[0];
	const fields = embed?.fields;
	const foundId = fields?.find(
		(field) => field.name === MODMAIL_NOTE_FIELD_NAME,
	)?.value;
	return foundId ? BigInt(foundId) : undefined;
}

// =============================================
// MODERATOR INTERACTION HANDLERS
// =============================================

/**
 * Handles the modmail archive button interaction
 * Creates an archive, sends it to user and archive channel, then closes the ticket
 */
export async function handleModmailArchive(interaction: ButtonInteraction) {
	await interaction.deferReply({ flags: ["Ephemeral"] });

	try {
		if (!interaction.channel?.isThread()) {
			await interaction.followUp({
				content: "This command can only be used in a modmail thread.",
				flags: ["Ephemeral"],
			});
			return;
		}

		const modMail = await getActiveModMailByChannel(
			BigInt(interaction.channelId),
		);
		if (!modMail) {
			await interaction.followUp({
				content: "This is not an active modmail thread.",
				flags: ["Ephemeral"],
			});
			return;
		}

		// Create archive using the filtered messages
		const archiveResult = await createArchiveFromThread(
			interaction.channel,
			modMail,
		);

		if (!archiveResult.success || !archiveResult.content) {
			await interaction.followUp({
				content: `Failed to create archive: ${archiveResult.error}`,
				flags: ["Ephemeral"],
			});
			return;
		}

		// Create HTML file attachment
		const htmlBuffer = Buffer.from(archiveResult.content, "utf-8");
		const fileName = `modmail-archive-${interaction.channel.name}-${Date.now()}.html`;
		const attachment = new AttachmentBuilder(htmlBuffer, { name: fileName });

		let dmSendSuccess = false;
		let archiveChannelSendSuccess = false;

		try {
			// Send to user's DM
			const user = await interaction.client.users.fetch(
				modMail.creatorId.toString(),
			);
			const dmChannel = await user.createDM();

			if (dmChannel.isSendable()) {
				await dmChannel.send({
					content:
						"Your modmail ticket has been archived. Here's a copy of the conversation:",
					files: [attachment],
				});
				dmSendSuccess = true;
				logger.info(
					`Successfully sent archive to user ${modMail.creatorId} via DM`,
				);
			} else {
				logger.warn(
					`Could not send archive to user ${modMail.creatorId} - DM not accessible`,
				);
			}
		} catch (error) {
			logger.error(
				`Failed to send archive to user ${modMail.creatorId} via DM:`,
				error,
			);
		}

		try {
			// Send to archive channel
			const guild = await interaction.client.guilds.fetch(config.guildId);
			const archiveChannel = await guild.channels.fetch(
				config.modmail.archiveChannel,
			);

			if (archiveChannel?.isTextBased() && archiveChannel.isSendable()) {
				// Create a new attachment for the archive channel (Discord requires separate instances)
				const archiveAttachment = new AttachmentBuilder(htmlBuffer, {
					name: fileName,
				});

				await archiveChannel.send({
					content: `Modmail ticket archived: ${interaction.channel.name}\nTicket ID: ${modMail.id}\nUser: <@${modMail.creatorId}>`,
					files: [archiveAttachment],
				});
				archiveChannelSendSuccess = true;
				logger.info(
					`Successfully sent archive to archive channel ${config.modmail.archiveChannel}`,
				);
			} else {
				logger.warn(
					`Could not send archive to archive channel - channel not accessible`,
				);
			}
		} catch (error) {
			logger.error(`Failed to send archive to archive channel:`, error);
		}

		// Close the ticket
		await closeModMailTicketByModMail(modMail);

		// Provide feedback to moderator
		let statusMessage = `Archive created with ${archiveResult.messageCount} messages.`;

		if (dmSendSuccess && archiveChannelSendSuccess) {
			statusMessage +=
				"\n✅ Sent to user's DM and archive channel. Deleting Thread in 10 seconds...";
		} else if (dmSendSuccess) {
			statusMessage +=
				"\n✅ Sent to user's DM.\n❌ Failed to send to archive channel.";
		} else if (archiveChannelSendSuccess) {
			statusMessage +=
				"\n❌ Failed to send to user's DM.\n✅ Sent to archive channel.";
		} else {
			statusMessage +=
				"\n❌ Failed to send to both user's DM and archive channel.";
		}

		await interaction.followUp({
			content: statusMessage,
			flags: ["Ephemeral"],
		});

		// Auto-delete thread after successful archiving
		setTimeout(async () => {
			if (!interaction.channel) {
				logger.warn(
					`Modmail thread ${interaction.channelId} was deleted before timeout or something went wrong!`,
				);
				return;
			}
			// Delete thread if both sends were successful
			if (dmSendSuccess && archiveChannelSendSuccess) {
				try {
					await interaction.channel.delete(
						"Modmail ticket archived and processed successfully",
					);
					logger.info(
						`Successfully deleted modmail thread ${interaction.channelId} after archiving`,
					);
				} catch (error) {
					logger.error(
						`Failed to delete thread ${interaction.channelId}:`,
						error,
					);
				}
			}
		}, 10 * 1000);
	} catch (error) {
		logger.error(`Error creating modmail archive:`, error);
		await interaction.followUp({
			content: "An error occurred while creating the archive.",
			flags: ["Ephemeral"],
		});
	}
}

/**
 * Handles the modmail assign button interaction
 * Creates a user selection menu for assigning moderators to tickets
 */
export async function handleModmailAssign(interaction: ButtonInteraction) {
	await interaction.deferReply({ flags: ["Ephemeral"] });

	try {
		if (!interaction.inGuild()) {
			await interaction.followUp({
				content: "This command can only be used in a guild.",
				flags: ["Ephemeral"],
			});
			return;
		}

		// Check if user has moderator permissions
		const member = await getMemberFromInteraction(interaction);
		if (!member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
			await interaction.followUp({
				content: "You don't have permission to assign tickets.",
				flags: ["Ephemeral"],
			});
			return;
		}

		if (!interaction.channel?.isThread()) {
			await interaction.followUp({
				content: "This command can only be used in a modmail thread.",
				flags: ["Ephemeral"],
			});
			return;
		}

		const modMail = await getActiveModMailByChannel(
			BigInt(interaction.channelId),
		);
		if (!modMail) {
			await interaction.followUp({
				content: "This is not an active modmail thread.",
				flags: ["Ephemeral"],
			});
			return;
		}

		// Create a user select menu for assignment
		const userSelect = new UserSelectMenuBuilder()
			.setCustomId(`modmail-assign-select-${modMail.id}`)
			.setPlaceholder("Select a moderator to assign")
			.setMaxValues(1)
			.setMinValues(1);

		const selectRow =
			new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(userSelect);

		await interaction.followUp({
			content: "Please select a moderator to assign this ticket to:",
			components: [selectRow],
			flags: ["Ephemeral"],
		});
	} catch (error) {
		logger.error("Failed to create assign selection:", error);
		await interaction.followUp({
			content: "An error occurred while creating the assignment selection.",
			flags: ["Ephemeral"],
		});
	}
}

/**
 * Handles the show notes button interaction
 * Displays all notes associated with the current modmail ticket
 */
export async function handleModmailShowNotes(interaction: ButtonInteraction) {
	await interaction.deferReply({ flags: ["Ephemeral"] });
	try {
		if (!interaction.inGuild()) {
			await interaction.followUp({
				content: "This command can only be used in a guild.",
				flags: ["Ephemeral"],
			});
			return;
		}

		// Check if user has moderator permissions
		const member = await getMemberFromInteraction(interaction);
		if (!member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
			await interaction.followUp({
				content: "You don't have permission to view notes",
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

		// Get all notes for this ticket
		const notes = await ModMailNote.findAll({
			where: {
				modMailTicketId: modMail.id,
			},
			order: [["createdAt", "ASC"]],
		});

		if (notes.length === 0) {
			await interaction.followUp({
				content: "No notes found for this ticket",
				flags: ["Ephemeral"],
			});
			return;
		}
		const noteEmbed = await generateEmbedsForModMailNotes(
			interaction.client,
			modMail,
			notes,
			member,
		);
		await interaction.followUp({
			embeds: [noteEmbed.embed],
			flags: ["Ephemeral"],
		});
	} catch (error) {
		logger.error("Failed to show notes:", error);
		await interaction.followUp({
			content: "An error occurred while showing notes.",
		});
	}
}

/**
 * Handles the add note button interaction
 * Directs users to use the slash command for adding notes
 */
export async function handleModmailAddNote(interaction: ButtonInteraction) {
	await interaction.deferReply({ flags: ["Ephemeral"] });

	try {
		if (!interaction.inGuild()) {
			await interaction.followUp({
				content: "This command can only be used in a guild.",
				flags: ["Ephemeral"],
			});
			return;
		}

		// Check if user has moderator permissions
		const member = await getMemberFromInteraction(interaction);
		if (!member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
			await interaction.followUp({
				content: "You don't have permission to add notes.",
				flags: ["Ephemeral"],
			});
			return;
		}

		if (!interaction.channel?.isThread()) {
			await interaction.followUp({
				content: "This command can only be used in a modmail thread.",
				flags: ["Ephemeral"],
			});
			return;
		}

		const modMail = await getActiveModMailByChannel(
			BigInt(interaction.channelId),
		);
		if (!modMail) {
			await interaction.followUp({
				content: "This is not an active modmail thread.",
				flags: ["Ephemeral"],
			});
			return;
		}

		await interaction.followUp({
			content:
				"Please use the `/ticket note` command to add a note with your desired content.",
			flags: ["Ephemeral"],
		});
	} catch (error) {
		logger.error("Failed to handle add note button:", error);
		await interaction.followUp({
			content: "An error occurred while processing the add note request.",
			flags: ["Ephemeral"],
		});
	}
}

// =============================================
// USER INTERACTION HANDLERS
// =============================================

/**
 * Handles the user details button interaction in DMs
 * Shows ticket information to the user who created the ticket
 */
export async function handleModmailUserDetails(interaction: ButtonInteraction) {
	await interaction.deferReply({ flags: ["Ephemeral"] });

	try {
		// Only allow this in DMs
		if (interaction.inGuild()) {
			await interaction.followUp({
				content: "This action can only be used in DMs.",
				flags: ["Ephemeral"],
			});
			return;
		}

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

		// Add additional details for the user
		ticketDetails.embed.addFields([
			{
				name: "Status",
				value: modMail.status,
				inline: true,
			},
		]);

		if (modMail.assignedUserId) {
			try {
				const assignedUser = await interaction.client.users.fetch(
					modMail.assignedUserId.toString(),
				);
				ticketDetails.embed.addFields({
					name: "Assigned Moderator",
					value: assignedUser.displayName,
					inline: true,
				});
			} catch {
				ticketDetails.embed.addFields({
					name: "Assigned Moderator",
					value: "Unknown",
					inline: true,
				});
			}
		} else {
			ticketDetails.embed.addFields({
				name: "Assigned Moderator",
				value: "Unassigned",
				inline: true,
			});
		}

		await interaction.followUp({
			embeds: [ticketDetails.embed],
			components: [ticketDetails.row],
			flags: ["Ephemeral"],
		});
	} catch (error) {
		logger.error("Failed to show user ticket details:", error);
		await interaction.followUp({
			content: "An error occurred while retrieving your ticket details.",
			flags: ["Ephemeral"],
		});
	}
}

/**
 * Handles the user close button interaction in DMs
 * Allows users to close their own tickets, creates an archive, and notifies the thread
 */
export async function handleModmailUserClose(interaction: ButtonInteraction) {
	await interaction.deferReply({ flags: ["Ephemeral"] });

	try {
		// Only allow this in DMs
		if (interaction.inGuild()) {
			await interaction.followUp({
				content: "This action can only be used in DMs.",
				flags: ["Ephemeral"],
			});
			return;
		}

		const modMail = await getActiveModMailByUser(BigInt(interaction.user.id));
		if (!modMail) {
			await interaction.followUp({
				content: "You don't have an active ticket.",
				flags: ["Ephemeral"],
			});
			return;
		}

		// Create archive before closing the ticket
		let archiveCreated = false;
		try {
			if (modMail.threadId) {
				const guild = await interaction.client.guilds.fetch(config.guildId);
				const thread = await guild.channels.fetch(modMail.threadId.toString());

				if (thread?.isThread()) {
					// Create archive using the filtered messages
					const archiveResult = await createArchiveFromThread(thread, modMail);

					if (archiveResult.success && archiveResult.content) {
						// Create HTML file attachment
						const htmlBuffer = Buffer.from(archiveResult.content, "utf-8");
						const fileName = `modmail-archive-${thread.name}-${Date.now()}.html`;
						const attachment = new AttachmentBuilder(htmlBuffer, {
							name: fileName,
						});
						if (interaction.channel?.isSendable()) {
							// Send archive to user's DM
							await interaction.channel?.send({
								content:
									"Your ticket has been closed and archived. Here's a copy of the conversation:",
								files: [attachment],
							});
						}

						// Send to archive channel
						try {
							const archiveChannel = await guild.channels.fetch(
								config.modmail.archiveChannel,
							);

							if (
								archiveChannel?.isTextBased() &&
								archiveChannel.isSendable()
							) {
								const archiveAttachment = new AttachmentBuilder(htmlBuffer, {
									name: fileName,
								});

								await archiveChannel.send({
									content: `Modmail ticket closed by user: ${thread.name}\nTicket ID: ${modMail.id}\nUser: <@${modMail.creatorId}>`,
									files: [archiveAttachment],
								});
							}
						} catch (error) {
							logger.warn("Failed to send archive to archive channel:", error);
						}

						archiveCreated = true;
						logger.info(
							`Successfully created archive for user-closed ticket ${modMail.id}`,
						);
					}
				}
			}
		} catch (error) {
			logger.error("Failed to create archive for user-closed ticket:", error);
		}

		// Close the ticket
		await closeModMailTicketByModMail(modMail);

		// Notify the thread if it exists
		try {
			if (modMail.threadId) {
				const guild = await interaction.client.guilds.fetch(config.guildId);
				const thread = await guild.channels.fetch(modMail.threadId.toString());

				if (thread?.isThread() && thread.isSendable()) {
					await thread.send({
						content: `🔒 Ticket has been closed by the user (${interaction.user.displayName}).${archiveCreated ? " Archive has been created." : ""}`,
					});
				}
			}
		} catch (error) {
			logger.warn("Failed to notify thread about user closing ticket:", error);
		}

		await interaction.followUp({
			content: `✅ Your ticket has been closed. Thank you for contacting us!${archiveCreated ? " An archive of your conversation has been sent above." : ""}`,
			flags: ["Ephemeral"],
		});
	} catch (error) {
		logger.error("Failed to close user ticket:", error);
		await interaction.followUp({
			content: "An error occurred while closing your ticket.",
			flags: ["Ephemeral"],
		});
	}
}
