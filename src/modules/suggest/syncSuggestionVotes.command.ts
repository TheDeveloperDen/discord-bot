import {
	ApplicationCommandType,
	type GuildMember,
	MessageFlags,
	PermissionFlagsBits,
} from "discord.js";
import type { Command } from "djs-slash-helper";
import { logger } from "../../logging.js";
import { removeSuggestionVotesForMembers } from "./suggest.js";

export const SyncSuggestionVotesCommand: Command<ApplicationCommandType.ChatInput> =
	{
		name: "syncsuggestionvotes",
		description: "Remove banned users from suggestion votes and refresh totals",
		type: ApplicationCommandType.ChatInput,
		default_permission: false,
		options: [],
		handle: async (interaction) => {
			if (
				!interaction.isChatInputCommand() ||
				!interaction.inGuild() ||
				interaction.guild === null
			) {
				return;
			}

			await interaction.deferReply({ flags: MessageFlags.Ephemeral });

			try {
				const bans = await interaction.guild.bans.fetch();
				if (bans.size === 0) {
					await interaction.editReply({
						content: "No banned users found.",
					});
					return;
				}

				const bannedUserIds = Array.from(bans.keys(), (userId) =>
					BigInt(userId),
				);
				const result = await removeSuggestionVotesForMembers(
					interaction.client,
					bannedUserIds,
				);

				await interaction.editReply({
					content:
						`Scanned ${bans.size} banned user(s). ` +
						`Removed ${result.removedVotes} vote(s) from ${result.affectedMembers} user(s). ` +
						`Refreshed ${result.updatedSuggestions} suggestion message(s).`,
				});
			} catch (error) {
				logger.error(
					"Failed to reconcile suggestion votes for banned users",
					error,
				);
				await interaction.editReply({
					content: "Failed to reconcile suggestion votes.",
				});
			}
		},
	};
