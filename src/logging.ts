import w from 'winston';
const {createLogger, format, transports} = w;

export const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.colorize({all: true}),
        format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        format.errors({stack: true}),
        format.splat(),
        format.json()
    ),
    defaultMeta: {service: 'DevDenBot'},
    transports: [
        //
        // - Write all logs with level `error` and below to `error.log`
        // - Write all logs with level `info` and below to `combined.log`
        //
        new transports.File({filename: 'logs/error.log', level: 'error'}),
        // write all logs to a file named the current time
        new transports.File({
            filename: `logs/${new Date().toISOString().replace(/:/g, '-')}.log`,
            level: 'info'
        }),
    ],
});

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
if (process.env.NODE_ENV !== 'production') {
    logger.level = 'debug'
    logger.add(new transports.Console({
        format: format.simple(),
    }));
}