import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const activityDirectory = dirname(fileURLToPath(import.meta.url));
const distDirectory = join(activityDirectory, "dist");
type Asset = {
	fileName: string;
	contentType: string;
	cacheControl: string;
};

const assets: Record<string, Asset> = {
	"/": {
		fileName: "index.html",
		contentType: "text/html; charset=utf-8",
		cacheControl: "no-cache",
	},
	"/index.html": {
		fileName: "index.html",
		contentType: "text/html; charset=utf-8",
		cacheControl: "no-cache",
	},
	"/app.js": {
		fileName: "app.js",
		contentType: "application/javascript; charset=utf-8",
		cacheControl: "no-cache",
	},
	"/style.css": {
		fileName: "style.css",
		contentType: "text/css; charset=utf-8",
		cacheControl: "no-cache",
	},
};

const securityHeaders = {
	"X-Content-Type-Options": "nosniff",
};

export type ActivityServerOptions = {
	clientId: string | null;
	port: number;
	hostname?: string;
};

export type ActivityServer = Bun.Server<undefined>;

export function parseActivityPort(value: string | undefined): number {
	if (!value) return 3001;

	const port = Number(value);
	if (!Number.isInteger(port) || port < 1 || port > 65_535) {
		throw new Error("ACTIVITY_PORT must be an integer between 1 and 65535");
	}

	return port;
}

function textResponse(
	body: string | null,
	status: number,
	headers: Record<string, string> = {},
): Response {
	return new Response(body, {
		status,
		headers: {
			...securityHeaders,
			"Content-Type": "text/plain; charset=utf-8",
			...headers,
		},
	});
}

async function assetResponse(asset: Asset, method: string): Promise<Response> {
	const file = Bun.file(join(distDirectory, asset.fileName));
	if (!(await file.exists())) {
		return textResponse(
			"BlockCount assets are unavailable. Run bun run activity:build first.",
			503,
			{ "Cache-Control": "no-store" },
		);
	}

	return new Response(method === "HEAD" ? null : file, {
		headers: {
			...securityHeaders,
			"Content-Type": asset.contentType,
			"Cache-Control": asset.cacheControl,
		},
	});
}

export function createActivityRequestHandler(clientId: string | null) {
	const configuredClientId = clientId?.trim() || null;

	return async function handleActivityRequest(
		request: Request,
	): Promise<Response> {
		if (request.method !== "GET" && request.method !== "HEAD") {
			return textResponse("Method Not Allowed", 405, { Allow: "GET, HEAD" });
		}

		const { pathname } = new URL(request.url);
		if (pathname === "/health") {
			return textResponse(request.method === "HEAD" ? null : "OK", 200, {
				"Cache-Control": "no-store",
			});
		}

		if (pathname === "/config.json") {
			return new Response(
				request.method === "HEAD"
					? null
					: JSON.stringify({ clientId: configuredClientId }),
				{
					headers: {
						...securityHeaders,
						"Content-Type": "application/json; charset=utf-8",
						"Cache-Control": "no-store",
					},
				},
			);
		}

		if (!Object.hasOwn(assets, pathname)) {
			return textResponse("Not Found", 404);
		}

		return assetResponse(assets[pathname], request.method);
	};
}

export function startActivityServer({
	clientId,
	port,
	hostname = "0.0.0.0",
}: ActivityServerOptions) {
	if (!Number.isInteger(port) || port < 0 || port > 65_535) {
		throw new Error(
			"Activity server port must be an integer between 0 and 65535",
		);
	}

	const server = Bun.serve({
		port,
		hostname,
		fetch: createActivityRequestHandler(clientId),
	});

	console.log(`BlockCount Activity server listening on ${server.url}`);
	return server;
}

if (import.meta.main) {
	startActivityServer({
		clientId: process.env.DISCORD_CLIENT_ID ?? null,
		port: parseActivityPort(process.env.ACTIVITY_PORT),
	});
}
