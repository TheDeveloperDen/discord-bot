import * as Sentry from "@sentry/bun";
import { type Interaction, MessageFlags, TextDisplayBuilder } from "discord.js";
import { capturedEventIds, logger } from "./logging.js";

export interface ObserveOptions {
	op: "command" | "component" | "event" | "job";
	name: string;
	interaction?: Interaction;
	tags?: Record<string, string>;
	/**
	 * Reports each run to a Sentry cron monitor which
	 * alerts when the job fails or doesn't run on schedule.
	 * `fn` must throw on failure for the check-in to be marked as failed.
	 */
	monitor?: { slug: string; crontab: string; maxRuntimeMinutes?: number };
}

/**
 * Runs `fn` in its own Sentry isolation scope and span, tagged with the
 * interaction's user, guild and channel.
 * If `fn` throws, the error will be captured and logged to Sentry, and an ephemeral error message will be sent to the interaction if possible.
 *
 * The promise resolves to the return value of `fn` if it succeeds, or `undefined` if it throws.
 */
export async function runObserved<T>(
	{ op, name, interaction, tags, monitor }: ObserveOptions,
	fn: () => T | Promise<T>,
): Promise<T | undefined> {
	// Create a new scope to avoid inheriting async contexts and potentially providing wrong information
	return Sentry.withIsolationScope(new Sentry.Scope(), (scope) =>
		Sentry.startNewTrace(() => observe(scope)),
	);

	async function observe(scope: Sentry.Scope) {
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
		Sentry.addBreadcrumb({
			category: op,
			message: `${op} ${name} started`,
			level: "info",
		});
		const attributes = { op, name };
		const start = performance.now();
		try {
			const run = monitor
				? () =>
						Sentry.withMonitor(monitor.slug, fn, {
							schedule: { type: "crontab", value: monitor.crontab },
							timezone: "UTC",
							maxRuntime: monitor.maxRuntimeMinutes ?? 10,
							checkinMargin: 5,
							// only raise an issue after 2 consecutive failures
							failureIssueThreshold: 2,
							recoveryThreshold: 1,
						})
				: fn;
			const result = await Sentry.startSpan({ op, name }, run);
			Sentry.metrics.count("handler.run", 1, {
				attributes: { ...attributes, outcome: "ok" },
			});
			return result;
		} catch (error) {
			Sentry.metrics.count("handler.run", 1, {
				attributes: { ...attributes, outcome: "error" },
			});
			// the logger may already have captured this error, and a second capture of
			// the same object is dropped, so reuse its id for the user-facing ref
			const eventId =
				(typeof error === "object" && error != null
					? capturedEventIds.get(error)
					: undefined) ?? Sentry.captureException(error);
			logger.error(`Error in ${op} ${name} (ref ${eventId})`, error);
			if (interaction) await replyWithError(interaction, eventId);
			return undefined;
		} finally {
			Sentry.metrics.distribution(
				"handler.duration",
				performance.now() - start,
				{ unit: "millisecond", attributes },
			);
		}
	}
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
