import * as Sentry from '@sentry/node'
import {Client} from 'discord.js'
import {logger} from './logging.js'


export function initSentry(client: Client) {
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

// TODO remove
export function wrapInTransaction<A extends Array<Item>, Item, T>(
    name: string,
    f: (trans: Sentry.Span, ...a: A) => T
): (...a: A) => T {
    return (...a: A) => {
        return Sentry.startSpan({name}, (span) => {
            return f(span, ...a)
        })
    }
}
