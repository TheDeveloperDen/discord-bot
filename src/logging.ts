import { createLogger, format, transports } from "winston";
import * as path from "path";

const timestamp = format.timestamp({
  format: "YYYY-MM-DD HH:mm:ss",
});
const baseFormat = format.combine(
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
    const filteredMeta = { ...meta };
    if (filteredMeta.service) delete filteredMeta.service;
    const metaString = Object.keys(filteredMeta).length
      ? JSON.stringify(filteredMeta, null, 2)
      : "";
    return `[${timestamp}] ${level}${source ? ` (${source})` : ""}: ${message}${metaString ? " " + metaString : ""}`;
  }),
);

export const logger = createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: baseFormat,
  defaultMeta: { service: "DevDenBot" },
  handleExceptions: true,
  transports: [
    // something slightly more readable for the cli
    new transports.Console({ format: cliFormat }),
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
