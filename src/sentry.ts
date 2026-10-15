import * as Sentry from "@sentry/bun";
import type { Client } from "discord.js";
import { logger } from "./logging.js";

export function initSentry(client: Client) {
	// Add a Sentry breadcrumb for every discord API call, since discord.js errors carry no useful stack frames.
	client.rest.on("response", (request, response) => {
		Sentry.addBreadcrumb({
			category: "discord.rest",
			message: `${request.method} ${request.route}`,
			level: response.ok ? "info" : "warning",
			data: { status: response.status, retries: request.retries },
		});
	});

	client.rest.on("rateLimited", (info) => {
		Sentry.addBreadcrumb({
			category: "discord.rest",
			message: `Rate limited: ${info.method} ${info.route}`,
			level: "warning",
			data: {
				global: info.global,
				scope: info.scope,
				timeToReset: info.timeToReset,
			},
		});
	});

	const gatewayCrumb = (
		message: string,
		shardId: number,
		level: Sentry.SeverityLevel = "info",
	) =>
		Sentry.addBreadcrumb({
			category: "discord.gateway",
			message,
			level,
			data: { shardId },
		});
	client.on("shardDisconnect", (_event, id) =>
		gatewayCrumb("shardDisconnect", id, "warning"),
	);
	client.on("shardReconnecting", (id) => gatewayCrumb("shardReconnecting", id));
	client.on("shardResume", (id) => gatewayCrumb("shardResume", id));
	client.on("shardReady", (id) => gatewayCrumb("shardReady", id));

	client.on("shardError", (error) => {
		logger.error("Discord shard error", error);
	});

	client.on("error", (error) => {
		logger.error("Discord client error", error);
	});
}
