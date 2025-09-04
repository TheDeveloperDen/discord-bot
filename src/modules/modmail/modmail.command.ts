import {
	type ActionRowBuilder,
	ApplicationCommandOptionType,
	ApplicationCommandType,
	type ButtonBuilder,
	type EmbedBuilder,
} from "discord.js";
import type { Command, ExecutableSubcommand } from "djs-slash-helper";
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
export const ModmailCommand: Command<ApplicationCommandType.ChatInput> = {
	name: "ticket",
	description: "Manage Tickets",
	type: ApplicationCommandType.ChatInput,
	options: [DetailsSubCommand],
	handle() {},
};
