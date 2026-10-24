import type { Client } from "discord.js";
import { logger } from "../logging.js";
import { blogRoutes } from "../modules/blog/blog.routes.js";
import { githubRoutes } from "../modules/github/github.routes.js";
import { githubLinkingEnabled } from "../modules/github/github.service.js";

let started = false;

/** Call once the bot is fully up, so the health check starts reporting healthy */
export function markStarted() {
	started = true;
}

export function createRoutes(
	client: Pick<Client, "users" | "channels">,
	fetchImpl: typeof fetch = fetch,
): Record<string, (req: Request) => Response | Promise<Response>> {
	return {
		// Docker healthcheck
		"/health": () =>
			started ? new Response("OK") : new Response("Starting", { status: 503 }),
		...(githubLinkingEnabled() ? githubRoutes(client, fetchImpl) : {}),
		...blogRoutes(client),
	};
}

export function startWebServer(client: Client) {
	const port = parseInt(process.env.WEB_PORT || "3000", 10);
	const server = Bun.serve({ port, routes: createRoutes(client) });
	logger.info(`Web server listening on port ${server.port}`);
	return server;
}
