import { logger } from "./logging.js";
export function startHealthCheck() {
	Bun.serve({
		routes: {
			"/health": new Response("OK"),
		},
	});
	logger.info("Health check server started on /health");
}
