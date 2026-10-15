import * as path from "node:path";
import * as Sentry from "@sentry/bun";
import { stringify } from "safe-stable-stringify";
import { SPLAT } from "triple-beam";
import { createLogger, format, transports } from "winston";
import Transport from "winston-transport";

const CAPTURED = Symbol("sentryCaptured");

/** Event ids of errors the logger has already sent to Sentry, so `runObserved` can reuse them */
export const capturedEventIds = new WeakMap<object, string>();

/**
 * Sends every `logger.error(..., error)` to Sentry as an issue. A lot of the codebase just logs errors and doesn't
 * report to Sentry, but this does that automagically!
 *
 * Sentry should automatically ignore duplicates, so there's nothing to worry about there :)
 */
const captureErrors = format((info) => {
	// winston might call the format multiple times
	if (info.level !== "error" || info[CAPTURED]) return info;
	info[CAPTURED] = true;
	try {
		const splat = (info[SPLAT] as unknown[] | undefined) ?? [];
		// `logger.error(error)` loses the Error instance but keeps its stack
		const error =
			splat.find((arg): arg is Error => arg instanceof Error) ??
			(typeof info.stack === "string"
				? Object.assign(new Error(String(info.message)), {
						stack: info.stack,
					})
				: undefined);
		if (error && !capturedEventIds.has(error)) {
			capturedEventIds.set(
				error,
				Sentry.captureException(error, {
					extra: { logMessage: info.message },
				}),
			);
		}
	} catch {
		// logging must never throw
	}
	return info;
});

const timestamp = format.timestamp({
	format: "YYYY-MM-DD HH:mm:ss",
});
const baseFormat = format.combine(
	captureErrors(),
	timestamp,
	format.errors({ stack: true }),
	format.splat(),
	format.json(),
);

const addSource = format((info) => {
	const oldStackTrace = Error.prepareStackTrace;
	Error.prepareStackTrace = (_, stack) => stack;
	const err = new Error();
	const stack = err.stack as unknown as NodeJS.CallSite[];
	Error.prepareStackTrace = oldStackTrace;

	// Find the first stack frame outside logging.ts
	const caller = stack?.find((s) => {
		const file = s.getFileName();
		return (
			file &&
			!file.includes("logging.ts") &&
			!file.includes("logging.js") &&
			!file.includes("node_modules") &&
			!file.startsWith("internal") &&
			!file.startsWith("node:") &&
			!file.includes("winston")
		);
	});
	if (caller) {
		info.source = `${path.basename(caller.getScriptNameOrSourceURL() || "")}:${caller.getLineNumber()}`;
	}
	return info;
});

const cliFormat = format.combine(
	addSource(),
	timestamp,

	format.colorize({
		all: true,
	}),
	format.printf(({ timestamp, level, message, source, ...meta }) => {
		const { service: _service, stack, ...rest } = meta;
		const metaString = Object.keys(rest).length ? stringify(rest, null, 2) : "";
		const header = `[${timestamp}] ${level}${source ? ` (${source})` : ""}: ${message}`;
		return [header, metaString, typeof stack === "string" ? stack : ""]
			.filter(Boolean)
			.join("\n");
	}),
);
const SentryTransport = Sentry.createSentryWinstonTransport(Transport, {
	levels: ["info", "warn", "error"],
});

export const logger = createLogger({
	level: process.env.NODE_ENV === "production" ? "info" : "debug",
	format: baseFormat,
	defaultMeta: { service: "DevDenBot" },
	handleExceptions: true,
	transports: [
		// something slightly more readable for the cli
		new transports.Console({ format: cliFormat }),
		new SentryTransport() as Transport,
		//
		// - Write all logs with level `error` and below to `error.log`
		// - Write all logs with level `info` and below to `combined.log`
		//
		new transports.File({
			filename: "logs/error.log",
			level: "error",
		}),
		// write all logs to a file named the current time
		new transports.File({
			filename: `logs/${new Date().toISOString().replace(/:/g, "-")}.log`,
			level: "info",
		}),
	],
});
