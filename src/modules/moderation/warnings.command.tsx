import { MessageFlags } from "discord.js";
import { Message, renderDiscordMessage } from "disjsx";
import { defineCommand, option } from "../../commands/index.js";
import { logger } from "../../logging.js";
import { getAllWarnings, type Warning } from "../../store/models/Warning.js";
import { Card, Field, memberAuthor } from "../../ui/index.js";
import { excerpt } from "../../util/strings.js";
import { isSpecialUser } from "../../util/users.js";
import { SEVERITY_EMOJI, SEVERITY_LABELS } from "./severity.js";

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

export const WarningsCommand = defineCommand({
	name: "warnings",
	description: "View warnings for a user",
	options: {
		user: option.user({
			description: "The user to check (leave empty for yourself)",
		}),
		include_expired: option.boolean({
			description: "Include expired and pardoned warnings (mods only)",
		}),
	},

	async handle(interaction, { user, include_expired: includeExpired = false }) {
		try {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });

			const targetUser = user || interaction.user;

			const isMod = isSpecialUser(interaction.member);

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

			const listOf = (list: Warning[], max: number) =>
				excerpt(
					list
						.slice(0, max)
						.map((w) => formatWarning(w, isMod))
						.join("\n\n"),
					{ maxLength: 1800 },
				);
			const showInactive =
				effectiveIncludeExpired && inactiveWarnings.length > 0;

			await interaction.editReply(
				renderDiscordMessage(
					<Message isV2>
						<Card
							accent={activeWarnings.length > 0 ? "Orange" : "Green"}
							title={
								isSelf ? "Your Warnings" : `Warnings for ${targetUser.username}`
							}
							author={memberAuthor(targetUser)}
							description={
								activeWarnings.length > 0
									? `${activeWarnings.length} active warning${activeWarnings.length === 1 ? "" : "s"}`
									: "No active warnings."
							}
							footer={
								isMod
									? `Total: ${warnings.length} · Active: ${activeWarnings.length}`
									: undefined
							}
							timestamp={Date.now()}
						>
							{activeWarnings.length > 0 && (
								<Field label={`Active Warnings (${activeWarnings.length})`}>
									{listOf(activeWarnings, 10)}
								</Field>
							)}
							{showInactive && (
								<Field label={`Expired/Pardoned (${inactiveWarnings.length})`}>
									{listOf(inactiveWarnings, 5)}
								</Field>
							)}
						</Card>
					</Message>,
				),
			);
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
});
