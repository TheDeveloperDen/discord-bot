import * as Sentry from "@sentry/bun";
import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { defineCommand, option } from "../../commands/index.js";
import { logger } from "../../logging.js";
import { createStandardEmbed } from "../../util/embeds.js";
import { parseTimespan, prettyPrintDuration } from "../../util/timespan.js";
import {
	dmModerationTarget,
	dmWarning,
	logModerationAction,
} from "../moderation/logs.js";

/** Discord's maximum timeout length */
export const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

/**
 * Parses a timeout duration, capped at 28 days (Discord's max length)
 * @returns the duration in milliseconds, or null if the input isn't a valid duration
 */
export function parseTimeoutDuration(input: string): number | null {
	const duration = parseTimespan(input);
	if (!Number.isFinite(duration) || duration <= 0) return null;
	return Math.min(duration, MAX_TIMEOUT_MS);
}

interface TimeoutParty {
	id: string;
	user: { bot: boolean };
	roles: { highest: { position: number } };
}

/**
 * Checks whether `moderator` may time out `target`.
 * @returns a reason for refusing, or null if the timeout is allowed
 */
export function checkCanTimeout(
	moderator: TimeoutParty,
	target: TimeoutParty & { moderatable: boolean },
	guildOwnerId: string,
): string | null {
	if (target.id === moderator.id) return "You can't time yourself out.";
	if (target.user.bot) return "Bots can't be timed out.";
	if (!target.moderatable) return "I'm not able to time out this member.";
	if (
		moderator.id !== guildOwnerId &&
		target.roles.highest.position >= moderator.roles.highest.position
	) {
		return "You can't time out a member with an equal or higher role.";
	}
	return null;
}

export const TimeoutCommand = defineCommand({
	name: "timeout",
	default_member_permissions: PermissionFlagsBits.ModerateMembers,
	description: "Times out a user",
	options: {
		target: option.member({
			description: "The user to timeout",
			required: true,
		}),
		duration: option.string({
			description: "How long to time out the user for",
			required: true,
		}),
		reason: option.string({
			description: "The reason for issuing the timeout",
			required: true,
		}),
	},

	async handle(interaction, { target, duration, reason }) {
		const period = parseTimeoutDuration(duration);
		if (period == null) {
			await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "Invalid duration. Use a format like `30m`, `2h` or `1d12h`.",
			});
			return;
		}

		const refusal = checkCanTimeout(
			interaction.member,
			target,
			interaction.guild.ownerId,
		);
		if (refusal != null) {
			await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: refusal,
			});
			return;
		}

		await interaction.deferReply();
		try {
			await target.timeout(period, reason);
		} catch (e) {
			Sentry.captureException(e);
			logger.error(`Failed to time out ${target.id}`, e);
			await interaction.editReply("Failed to time out that member.");
			return;
		}

		const dmSent = await dmModerationTarget(
			target.user,
			`You were timed out in ${interaction.guild.name} for **${prettyPrintDuration(period)}**: ${reason}`,
		);
		await interaction.editReply({
			embeds: [
				{
					...createStandardEmbed(target),
					title: "User timed out",
					description: `<@${target.id}>`,
					fields: [
						{
							name: "Timed out until",
							value: `<t:${Math.round((Date.now() + period) / 1000)}>`,
						},
						{
							name: "Reason",
							value: reason,
						},
					],
				},
			],
			content: dmWarning(dmSent) || undefined,
		});

		await logModerationAction(interaction.client, {
			kind: "Timeout",
			moderator: interaction.user,
			target: target.user,
			duration: period,
			reason,
			dmSent,
		});
	},
});

export default TimeoutCommand;
