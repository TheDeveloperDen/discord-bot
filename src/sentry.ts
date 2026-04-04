import * as Sentry from "@sentry/bun";
import type { Client } from "discord.js";
import { logger } from "./logging.js";

export function initSentry(client: Client) {
	client.on("shardError", (error) => {
		logger.error(error);
		Sentry.captureException(error);
	});

	client.on("error", (error) => {
		logger.error(error);
		Sentry.captureException(error);
	});
}
