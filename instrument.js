import * as Sentry from "@sentry/bun";

// Must run before any other module is imported
Sentry.init({
	dsn: process.env.DDB_SENTRY_DSN,
	environment:
		process.env.NODE_ENV === "production" ? "production" : "development",
	// Git commit SHA, provided by Docker build
	release: process.env.SENTRY_RELEASE || undefined,
	sendDefaultPii: true,
	tracesSampleRate: 1.0,
	integrations: [
		Sentry.extraErrorDataIntegration(),
		Sentry.postgresIntegration(),
	],
});
