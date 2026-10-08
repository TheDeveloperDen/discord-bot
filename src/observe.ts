import * as Sentry from "@sentry/bun";
import { type Interaction, MessageFlags, TextDisplayBuilder } from "discord.js";
import { logger } from "./logging.js";

export interface ObserveOptions {
	op: "command" | "component" | "event";
	name: string;
	interaction?: Interaction;
	tags?: Record<string, string>;
}

/**
 * Runs `fn` in its own Sentry isolation scope and span, tagged with the
 * interaction's user, guild and channel.
 * If `fn` throws, the error will be captured and logged to Sentry, and an ephemeral error message will be sent to the interaction if possible.
 *
 * The promise resolves to the return value of `fn` if it succeeds, or `undefined` if it throws.
 */
export async function runObserved<T>(
	{ op, name, interaction, tags }: ObserveOptions,
	fn: () => T | Promise<T>,
): Promise<T | undefined> {
	return Sentry.withIsolationScope(async (scope) => {
		scope.setTags({ op, name, ...tags });
		if (interaction) {
			scope.setUser({
				id: interaction.user.id,
				username: interaction.user.tag,
			});
			scope.setTags({
				guild: interaction.guildId ?? "dm",
				channel: interaction.channelId ?? "unknown",
			});
		}
		try {
			return await Sentry.startSpan({ op, name }, fn);
		} catch (error) {
			const eventId = Sentry.captureException(error);
			logger.error(`Error in ${op} ${name} (ref ${eventId})`, error);
			if (interaction) await replyWithError(interaction, eventId);
			return undefined;
		}
	});
}

/**
 * Replies to an interaction with an ephemeral error message containing the Sentry event id.
 * This function will silently do nothing if the interaction cannot be replied to.
 */
async function replyWithError(
	interaction: Interaction,
	eventId: string,
): Promise<void> {
	if (!interaction.isRepliable()) return;
	const payload = {
		components: [
			new TextDisplayBuilder().setContent(
				`Something went wrong (to report to an admin use ref: \`${eventId}\`)`,
			),
		],
		flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
	} as const;
	try {
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp(payload);
		} else {
			await interaction.reply(payload);
		}
	} catch (e) {
		logger.warn("Failed to send error reply", e);
	}
}
