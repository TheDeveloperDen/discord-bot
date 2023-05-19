import * as Sentry from '@sentry/node'
import { SpanContext } from '@sentry/types'
import { Client } from 'discord.js'
import { ProfilingIntegration } from '@sentry/profiling-node'
import { logger } from './logging.js'
import { toJson } from './json.js'

export function initSentry (client: Client) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new ProfilingIntegration(),
      ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
      new Sentry.Integrations.Postgres()
    ]
  })

  process.on('unhandledRejection', (error) => {
    logger.error(error)
    Sentry.captureException(error)
  })

  client.on('shardError', (error) => {
    logger.error(error)
    Sentry.captureException(error)
  })

  client.on('error', (error) => {
    logger.error(error)
    Sentry.captureException(error)
  })
}

export function wrapInTransaction<A extends any[], T> (
  name: string,
  f: (trans: Sentry.Span, ...a: A) => T
): (...a: A) => T {
  // noinspection JSUnusedLocalSymbols compiliation breaks if we remove this for some reason
  return wrapInTransactionWith(name, (...a: A) => {
    return {}
  }, f)
}

export function inTransaction<T> (
  name: string,
  f: () => T
): () => T {
  // noinspection JSUnusedLocalSymbols compiliation breaks if we remove this for some reason
  return wrapInTransactionWith(name, () => {
    return {}
  }, f)
}

export function wrapInChild<A extends any[], T> (
  parent: Sentry.Span,
  name: string,
  f: (trans: Sentry.Span, ...a: A) => T
): (...a: A) => T {
  // noinspection JSUnusedLocalSymbols compiliation breaks if we remove this for some reason
  return wrapInChildWith(parent, name, (...a: A) => {
    return {}
  }, f)
}

export function wrapInTransactionWith<A extends any[], T> (
  name: string,
  op: (...a: A) => SpanContext,
  f: (trans: Sentry.Span, ...a: A) => T
): (...a: A) => T {
  return (...a: A) => {
    const opResult = op(...a)
    const span = getOrCreateSpan(name, undefined, opResult)
    try {
      return f(span, ...a)
    } finally {
      span.finish()
    }
  }
}

export function inTransactionWith<T> (
  name: string,
  op: SpanContext,
  f: () => T
): T {
  return wrapInTransactionWith(name, () => op, () => f())()
}

export function wrapInChildWith<A extends any[], T> (
  parent: Sentry.Span,
  name: string,
  op: (...a: A) => SpanContext,
  f: (trans: Sentry.Span, ...a: A) => T
): (...a: A) => T {
  return (...a: A) => {
    const opResult = op(...a)
    const span = getOrCreateSpan(name, parent, opResult)
    try {
      return f(span, ...a)
    } finally {
      span.finish()
    }
  }
}

export function inChildOf<T> (
  parent: Sentry.Span,
  name: string,
  op: SpanContext,
  f: () => T
): T {
  return wrapInChildWith(parent, name, () => op, () => f())()
}

function getOrCreateSpan (
  name: string,
  parent?: Sentry.Span,
  op?: SpanContext
): Sentry.Span {
  if (parent) {
    logger.debug(
      `Creating new child span with name (op) ${name} and options ${
        toJson(op)
      }`
    )
    return parent.startChild({ op: name, ...op })
  }
  logger.debug(
    `Creating new span with name ${name} and options ${toJson(op)}`
  )
  return Sentry.startTransaction({ name, ...op })
}
