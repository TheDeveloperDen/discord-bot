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
	type EmbedAuthorData,
	type EmbedBuilder,
	type JSONEncodable,
	type Message,
	PermissionFlagsBits,
	type SelectMenuComponentOptionData,
	StringSelectMenuBuilder,
	type User,
	UserSelectMenuBuilder,
} from "discord.js";
import Handlebars from "handlebars";
import { config } from "../../Config.js";
import { logger } from "../../logging.js";
import {
	ModMailTicket,
	ModMailTicketCategory,
	ModMailTicketStatus,
} from "../../store/models/ModMailTicket.js";
import { createStandardEmbed } from "../../util/embeds.js";
import { getMemberFromInteraction } from "../../util/member.js";
import { fetchAllMessagesWithRetry } from "../../util/message.js";
import { actualMentionById } from "../../util/users.js";

export const MODMAIL_SUBMIT_ID = "modmail-submit";
export const MODMAIL_CATEGORY_SELECT_ID = "modmail-category-select";
export const MODMAIL_ARCHIVE_ID = "modmail-archive";
export const MODMAIL_ASSIGN_ID = "modmail-assign";
export const MODMAIL_USER_DETAILS_ID = "modmail-user-details";
export const MODMAIL_USER_CLOSE_ID = "modmail-user-close";

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

export async function getActiveModMailByUser(userId: bigint) {
	return await ModMailTicket.findOne({
		where: {
			creatorId: userId,
			status: ModMailTicketStatus.OPEN,
		},
	});
}

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

export async function getActiveModMailByChannel(threadId: bigint) {
	return await ModMailTicket.findOne({
		where: {
			threadId: threadId,
			status: ModMailTicketStatus.OPEN,
		},
	});
}

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

export async function closeModMailTicketByModMail(ticket: ModMailTicket) {
	return await ticket.update({
		status: ModMailTicketStatus.ARCHIVED,
	});
}

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

	// Moderator buttons (existing functionality)
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

	const archiveButton = new ButtonBuilder()
		.setStyle(ButtonStyle.Danger)
		.setLabel("Archive")
		.setCustomId(MODMAIL_ARCHIVE_ID);

	const assignButton = new ButtonBuilder()
		.setStyle(ButtonStyle.Primary)
		.setLabel("Assign")
		.setCustomId(MODMAIL_ASSIGN_ID);

	const actionRow =
		new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents([
			archiveButton,
			assignButton,
		]);
	return { embed: embed, row: actionRow };
}

export const extractEmbedAndFilesFromMessageModMail: (
	message: Message,
	user: User,
) => {
	embed: EmbedBuilder;
	files?: AttachmentBuilder[];
} = (message, user) => {
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
};
export const handleModmailArchive = async (interaction: ButtonInteraction) => {
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

		// Provide feedback to moderator if we reach here (thread wasn't deleted)
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
					// Since thread is deleted, we can't send followUp, so log instead
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
};

export const handleModmailAssign = async (interaction: ButtonInteraction) => {
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
};
export const handleModmailUserDetails = async (
	interaction: ButtonInteraction,
) => {
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
};
export const handleModmailUserClose = async (
	interaction: ButtonInteraction,
) => {
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
};
