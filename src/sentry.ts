import * as Sentry from "@sentry/node";
import {Client} from "discord.js";
import {ProfilingIntegration} from "@sentry/profiling-node";


export function initSentry(client: Client) {
	Sentry.init({
		dsn: process.env.SENTRY_DSN,
		tracesSampleRate: 1.0,
		profilesSampleRate: 1.0,
		integrations: [
			new Sentry.Integrations.Http({tracing: true}),
			new ProfilingIntegration(),
			...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
		]
	})

	process.on('unhandledRejection', (error) => {
		Sentry.captureException(error)
	})

	client.on('shardError', error => {
		Sentry.captureException(error)
	})
}


export function inTransaction<A, T>(op: string, name: string, f: (trans: Sentry.Transaction, a: A) => T): (a: A) => T {
	return (a: A) => {
		const transaction = Sentry.startTransaction({
			op,
			name
		})
		Sentry.getCurrentHub().configureScope(scope => scope.setSpan(transaction));
		try {
			return f(transaction, a)
		} finally {
			transaction.finish()
		}
	}
}