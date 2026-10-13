import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { defineCommand } from "../../commands/index.js";
import { logger } from "../../logging.js";
import { removeSuggestionVotesForMembers } from "./suggest.js";

export const SyncSuggestionVotesCommand = defineCommand({
	name: "syncsuggestionvotes",
	description: "Remove banned users from suggestion votes and refresh totals",
	default_member_permissions: PermissionFlagsBits.Administrator,
	async handle(interaction) {
		const member = interaction.member;
		if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
			await interaction.reply({
				content: "You don't have permission to run this command.",
				flags: MessageFlags.Ephemeral,
			});
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

			const bannedUserIds = Array.from(bans.keys(), (userId) => BigInt(userId));
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
});
