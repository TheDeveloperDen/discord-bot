import * as Sentry from '@sentry/node'
import {RewriteFrames} from '@sentry/integrations'
import {logger} from '../logging.js'

Sentry.init({
	dsn: process.env.SENTRY_DSN,
	tracesSampleRate: 1.0,
	integrations: [
		new RewriteFrames({
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			root: global.__rootdir__,
		}),
		new Sentry.Integrations.OnUncaughtException(),
		new Sentry.Integrations.OnUnhandledRejection(),
		new Sentry.Integrations.Console()
	],
})


export const sentry = (e: unknown) => {
	logger.error(e)
	Sentry.captureException(e)
}