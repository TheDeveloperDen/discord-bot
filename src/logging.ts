import winston from 'winston';

export const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    defaultMeta: {service: 'user-service'},
    transports: [
        //
        // - Write all logs with level `error` and below to `error.log`
        // - Write all logs with level `info` and below to `combined.log`
        //
        new winston.transports.File({filename: 'error.log', level: 'error'}),
        // write all logs to a file named the current time
        new winston.transports.File({filename: new Date().toISOString().replace(/:/g, '-') + ".log", level: 'info'}),
    ],
});

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
if (process.env.NODE_ENV !== 'production') {
    logger.level = 'debug'
    logger.add(new winston.transports.Console({
        format: winston.format.simple(),
    }));
}