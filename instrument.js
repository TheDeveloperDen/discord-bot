import * as Sentry from "@sentry/bun";

// Must run before any other module is imported
/**
 * discord.js REST errors all have the same call stack, so different errors end up grouped in one issue.
 * This function tries to split them by Discord error code and the templated route instead
 */
function discordFingerprint(error) {
	if (error?.name?.startsWith("DiscordAPIError") !== true) return undefined;
	if (typeof error.url !== "string") return undefined;
	let path;
	try {
		path = new URL(error.url).pathname;
	} catch {
		return undefined;
	}
	// snowflakes -> :id, and drop the API version prefix
	const route = path.replace(/^\/api\/v\d+/, "").replace(/\d{15,}/g, ":id");
	return ["discord-api-error", String(error.code), error.method, route];
}

Sentry.init({
	dsn: process.env.DDB_SENTRY_DSN,
	environment:
		process.env.NODE_ENV === "production" ? "production" : "development",
	// Git commit SHA, provided by Docker build
	release: process.env.SENTRY_RELEASE || undefined,
	sendDefaultPii: true,
	enableLogs: true,
	tracesSampleRate: 1.0,
	beforeSend(event, hint) {
		const fingerprint = discordFingerprint(hint.originalException);
		if (fingerprint) event.fingerprint = fingerprint;
		return event;
	},
	integrations: [
		Sentry.extraErrorDataIntegration(),
		Sentry.postgresIntegration(),
	],
});
