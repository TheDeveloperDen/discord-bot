import * as Sentry from "@sentry/node";
import {RewriteFrames} from "@sentry/integrations";
import {logger} from "../logging.js";

Sentry.init({
    dsn: "https://5af1a6678a03488e8b75f890cae76081@o668259.ingest.sentry.io/6124318",
    tracesSampleRate: 1.0,
    integrations: [
        new RewriteFrames({
            // @ts-ignore
            root: global.__rootdir__,
        }),
        new Sentry.Integrations.OnUncaughtException(),
        new Sentry.Integrations.OnUnhandledRejection(),
        new Sentry.Integrations.Console()
    ],
});

export function runCatching<T>(fn: () => T): T {
    try {
        return fn();
    } catch (e) {
        Sentry.captureException(e);
        logger.error(e);
        throw e;
    }
}

export const sentry = Sentry.captureException