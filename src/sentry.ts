import * as Sentry from '@sentry/node'
import { Client } from 'discord.js'
import { ProfilingIntegration } from '@sentry/profiling-node'

export function initSentry (client: Client) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new ProfilingIntegration(),
      ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
      new Sentry.Integrations.Mysql()
    ]
  })

  process.on('unhandledRejection', (error) => {
    Sentry.captureException(error)
  })

  client.on('shardError', error => {
    Sentry.captureException(error)
  })
}

export function inTransaction<A, T> (
  op: string, f: (a: A, trans: Sentry.Span) => T): (a: A) => T {
  return (a: A) => {
    const span = Sentry.getCurrentHub()
      .getScope()
      .getTransaction()
      ?.startChild({ op }) ?? Sentry.startTransaction({
      op,
      name: op
    })
    Sentry.getCurrentHub().configureScope(scope => scope.setSpan(span))
    try {
      return f(a, span)
    } finally {
      span.finish()
    }
  }
}
