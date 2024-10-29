import * as Sentry from "@sentry/node";
import {nodeProfilingIntegration} from "@sentry/profiling-node";

// Ensure to call this before importing any other modules!
Sentry.init({
    dsn: process.env.DDB_SENTRY_DSN,

    release: process.env.npm_package_version ?? process.env.VERSION ?? 'unknown',
    tracesSampleRate: 1.0,
    profilesSampleRate: 0.2,
    integrations: [
        nodeProfilingIntegration(),
    ]
});
