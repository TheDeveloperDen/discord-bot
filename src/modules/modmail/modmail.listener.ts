import { clearTimeout } from "node:timers";
import {
	type ActionRowBuilder,
	type ButtonBuilder,
	ChannelType,
	type EmbedBuilder,
	type Interaction,
} from "discord.js";
import { config } from "../../Config.js";
import { logger } from "../../logging.js";
import { ModMailTicketCategory } from "../../store/models/ModMailTicket.js";
import { mentionRoleById } from "../../util/role.js";
import type { EventListener } from "../module.js";
import {
	closeModMailTicketByModMail,
	createModMailDetails,
	createModMailInitializationEmbed,
	createModMailTicket,
	extractEmbedAndFilesFromMessageModMail,
	getActiveModMailByUser,
	hasActiveModMailByUser,
	MODMAIL_CATEGORY_SELECT_ID,
	MODMAIL_SUBMIT_ID,
} from "./modmail.js";

const pendingModmailSelections = new Map<
	string,
	{
		category: ModMailTicketCategory;
		timeout: NodeJS.Timeout;
	}
>(); // userId -> selectedCategory

export const ModMailListener: EventListener[] = [
	{
		async messageCreate(client, message) {
			if (
				!message.channel.isDMBased() ||
				message.author.bot ||
				message.author.system
			)
				return;
			const modMail = await getActiveModMailByUser(BigInt(message.author.id));

			if (!modMail) {
				const initializationMessage = createModMailInitializationEmbed(
					message.author,
				);
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
			const guild = await client.guilds.fetch(config.guildId);

			const thread = await guild.channels.fetch(modMail.threadId.toString());

			if (!thread?.isThread() || !thread.isSendable()) return;

			const parsedMessage = extractEmbedAndFilesFromMessageModMail(message);

			await thread.send({ content: message.content });
		},
		async interactionCreate(client, interaction: Interaction) {
			if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
			const user = interaction.user;
			if (interaction.customId === MODMAIL_SUBMIT_ID) {
				await interaction.deferUpdate();
				if (await hasActiveModMailByUser(BigInt(user.id))) {
					await interaction.message.delete();
					await interaction.followUp({
						content: "You already have an open ticket",
					});
					return;
				}
				const userConfig = pendingModmailSelections.get(user.id) ?? {
					category: ModMailTicketCategory.QUESTION,
				};

				if ("timeout" in userConfig) clearTimeout(userConfig.timeout);

				const catgegory = userConfig.category;

				const guild = await client.guilds.fetch(config.guildId);

				const channel = await guild.channels.fetch(config.modmail.channel);
				if (!channel) {
					await interaction.followUp({ content: "Modmail channel not found" });
					logger.error("Modmail channel not found");
					return;
				}

				if (!channel.isTextBased() || channel.type !== ChannelType.GuildText) {
					await interaction.followUp({
						content: "Modmail channel is not a text channel",
					});
					logger.error("Modmail channel is not a text channel");
					return;
				}

				const thread = await channel.threads.create({
					name: `${catgegory} - ${interaction.user.tag}`,
					reason: `Modmail thread created by ${user.tag}`,
					type: ChannelType.PublicThread,
				});
				const ticket = await createModMailTicket(
					BigInt(user.id),
					BigInt(thread.id),
					catgegory,
				);
				const ticketDetails = createModMailDetails(ticket, user, true) as {
					embed: EmbedBuilder;
					row: ActionRowBuilder<ButtonBuilder>;
				};

				await thread.send({
					content: `A new ticket has been created! ${config.modmail.pingRole ? mentionRoleById(config.modmail.pingRole) : ""}`,
					embeds: [ticketDetails.embed],
					components: [ticketDetails.row],
				});
				if (!interaction.channel?.isSendable()) return;
				const userTicketDetails = createModMailDetails(ticket, user, true) as {
					embed: EmbedBuilder;
					row: null;
				};

				await interaction.channel.send({
					content: `Your ticket has been created.`,
					embeds: [userTicketDetails.embed],
				});

				await interaction.message.delete();
			} else if (
				interaction.isStringSelectMenu() &&
				interaction.customId === MODMAIL_CATEGORY_SELECT_ID
			) {
				const category = interaction.values[0] as ModMailTicketCategory;

				const timeout = setTimeout(() => {
					pendingModmailSelections.delete(interaction.user.id);
				}, 600 * 1000);

				pendingModmailSelections.set(interaction.user.id, {
					category,
					timeout,
				});

				await interaction.deferUpdate();
			}
		},
	},
];
