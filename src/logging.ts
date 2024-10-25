import {createLogger, format, transports} from 'winston'

const timestamp = format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
})
const baseFormat = format.combine(
    timestamp,
    format.errors({stack: true}),
    format.splat(),
    format.json()
)

const cliFormat = format.combine(
    baseFormat,
    format.colorize({
        level: true,
    }),
    format.printf(
        (info) => `[${info.timestamp}] ${info.level}: ${info.message}`
    )
);

export const logger = createLogger({
    level: 'info',
    format: baseFormat,
    defaultMeta: {service: 'DevDenBot'},
    transports: [
        // something slightly more readable for the cli
        new transports.Console({format: format.combine(format.cli(), cliFormat)}),
        //
        // - Write all logs with level `error` and below to `error.log`
        // - Write all logs with level `info` and below to `combined.log`
        //
        new transports.File({
            filename: 'logs/error.log',
            level: 'error'
        }),
        // write all logs to a file named the current time
        new transports.File({
            filename: `logs/${new Date().toISOString().replace(/:/g, '-')}.log`,
            level: 'info'
        })
    ]
})

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
if (process.env.NODE_ENV !== 'production') {
    logger.level = 'debug'
}
