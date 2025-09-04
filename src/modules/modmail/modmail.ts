import { readFileSync } from "node:fs";
import type { MessageActionRowComponentBuilder } from "@discordjs/builders";
import {
	ActionRowBuilder,
	type AnyThreadChannel,
	AttachmentBuilder,
	type AttachmentPayload,
	ButtonBuilder,
	ButtonStyle,
	type EmbedBuilder,
	type JSONEncodable,
	type Message,
	type SelectMenuComponentOptionData,
	StringSelectMenuBuilder,
	type User,
} from "discord.js";
import Handlebars from "handlebars";
import { logger } from "../../logging.js";
import {
	ModMailTicket,
	ModMailTicketCategory,
	ModMailTicketStatus,
} from "../../store/models/ModMailTicket.js";
import { createStandardEmbed } from "../../util/embeds.js";
import { fetchAllMessagesWithRetry } from "../../util/message.js";
import { actualMentionById } from "../../util/users.js";

export const MODMAIL_SUBMIT_ID = "modmail-submit";
export const MODMAIL_CATEGORY_SELECT_ID = "modmail-category-select";
export const MODMAIL_ARCHIVE_ID = "modmail-archive";
export const MODMAIL_ASSIGN_ID = "modmail-assign";

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
		const messages = await fetchAllMessagesWithRetry(thread, 3, 50000); // Max 3 retries, up to 50k messages

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

				return {
					id: message.id,
					content: message.content || "",
					createdAt: message.createdAt.toLocaleString(),
					author: {
						id: message.author.id,
						username: message.author.username,
						displayName: message.author.displayName || message.author.username,
						avatarURL: message.author.displayAvatarURL({ size: 128 }),
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
		const html = template(templateData);

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

	if (!moderator) {
		return { embed: embed, row: null };
	}

	if (modMailTicket.assignedUserId) {
		embed.addFields({
			name: "Assigned Moderator",
			value: actualMentionById(modMailTicket.assignedUserId),
		});
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
) => Promise<{
	embed: EmbedBuilder;
	files?: AttachmentBuilder[];
}> = async (message, user) => {
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
