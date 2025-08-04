import * as Sentry from "@sentry/node";

console.log("Starting Sentry Profiling Integration");
// Ensure to call this before importing any other modules!
Sentry.init({
  dsn: process.env.DDB_SENTRY_DSN,
  sendDefaultPii: true,
  release: process.env.npm_package_version ?? process.env.VERSION ?? "unknown",
  tracesSampleRate: 1.0,
  profilesSampleRate: 0.2,
  integrations: [],
});
