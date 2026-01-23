import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	EmbedBuilder,
	MessageFlags,
} from "discord.js";
import type { Command } from "djs-slash-helper";
import { logger } from "../../logging.js";
import {
	getAllWarnings,
	type Warning,
	WarningSeverity,
} from "../../store/models/Warning.js";
import { isSpecialUser } from "../../util/users.js";

const SEVERITY_LABELS: Record<WarningSeverity, string> = {
	[WarningSeverity.MINOR]: "Minor",
	[WarningSeverity.MODERATE]: "Moderate",
	[WarningSeverity.SEVERE]: "Severe",
};

const SEVERITY_EMOJI: Record<WarningSeverity, string> = {
	[WarningSeverity.MINOR]: "🟡",
	[WarningSeverity.MODERATE]: "🟠",
	[WarningSeverity.SEVERE]: "🔴",
};

function formatWarning(warning: Warning, isMod: boolean): string {
	const emoji = SEVERITY_EMOJI[warning.severity];
	const severity = SEVERITY_LABELS[warning.severity];
	const date = `<t:${Math.floor(warning.createdAt.getTime() / 1000)}:d>`;

	let status = "";
	if (warning.pardoned) {
		status = " *(Pardoned)*";
	} else if (warning.expired) {
		status = " *(Expired)*";
	}

	if (isMod) {
		const expires = warning.expiresAt
			? `<t:${Math.floor(warning.expiresAt.getTime() / 1000)}:R>`
			: "Never";
		return (
			`${emoji} **#${warning.id}** - ${severity}${status}\n` +
			`  ${date} | Expires: ${expires}\n` +
			`  Reason: ${warning.reason.slice(0, 100)}${warning.reason.length > 100 ? "..." : ""}`
		);
	}

	return `${emoji} ${date} - ${severity}${status}: ${warning.reason.slice(0, 50)}${warning.reason.length > 50 ? "..." : ""}`;
}

export const WarningsCommand: Command<ApplicationCommandType.ChatInput> = {
	name: "warnings",
	description: "View warnings for a user",
	type: ApplicationCommandType.ChatInput,
	options: [
		{
			type: ApplicationCommandOptionType.User,
			name: "user",
			description: "The user to check (leave empty for yourself)",
			required: false,
		},
		{
			type: ApplicationCommandOptionType.Boolean,
			name: "include_expired",
			description: "Include expired and pardoned warnings (mods only)",
			required: false,
		},
	],

	handle: async (interaction) => {
		if (!interaction.isChatInputCommand() || !interaction.inGuild()) return;

		try {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });

			const targetUser =
				interaction.options.getUser("user") || interaction.user;
			const includeExpired =
				interaction.options.getBoolean("include_expired") ?? false;

			const member = await interaction.guild?.members
				.fetch(interaction.user.id)
				.catch(() => null);
			const isMod = member ? isSpecialUser(member) : false;

			const isSelf = targetUser.id === interaction.user.id;
			if (!isSelf && !isMod) {
				await interaction.editReply({
					content: "You can only view your own warnings.",
				});
				return;
			}

			const effectiveIncludeExpired = isMod && includeExpired;
			const warnings = await getAllWarnings(
				BigInt(targetUser.id),
				effectiveIncludeExpired,
			);

			if (warnings.length === 0) {
				await interaction.editReply({
					content: isSelf
						? "You have no warnings."
						: `${targetUser.username} has no warnings.`,
				});
				return;
			}

			const activeWarnings = warnings.filter((w) => !w.expired && !w.pardoned);
			const inactiveWarnings = warnings.filter((w) => w.expired || w.pardoned);

			const embed = new EmbedBuilder()
				.setTitle(
					isSelf ? "Your Warnings" : `Warnings for ${targetUser.username}`,
				)
				.setColor(activeWarnings.length > 0 ? "Orange" : "Green")
				.setThumbnail(targetUser.displayAvatarURL())
				.setTimestamp();

			if (activeWarnings.length > 0) {
				const activeList = activeWarnings
					.slice(0, 10)
					.map((w) => formatWarning(w, isMod))
					.join("\n\n");

				embed.addFields({
					name: `Active Warnings (${activeWarnings.length})`,
					value: activeList || "None",
				});
			} else {
				embed.setDescription("No active warnings.");
			}

			if (effectiveIncludeExpired && inactiveWarnings.length > 0) {
				const inactiveList = inactiveWarnings
					.slice(0, 5)
					.map((w) => formatWarning(w, isMod))
					.join("\n\n");

				embed.addFields({
					name: `Expired/Pardoned (${inactiveWarnings.length})`,
					value: inactiveList,
				});
			}

			if (isMod) {
				embed.setFooter({
					text: `Total: ${warnings.length} | Active: ${activeWarnings.length}`,
				});
			}

			await interaction.editReply({ embeds: [embed] });
		} catch (e) {
			logger.error("Failed to fetch warnings:", e);
			if (interaction.replied || interaction.deferred) {
				await interaction.editReply("Something went wrong!");
			} else {
				await interaction.reply({
					content: "Something went wrong!",
					flags: MessageFlags.Ephemeral,
				});
			}
		}
	},
};
