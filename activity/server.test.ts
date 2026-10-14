import { describe, expect, it } from "bun:test";
import { createActivityRequestHandler } from "./server.js";

const handleActivityRequest = createActivityRequestHandler(null);

describe("BlockCount activity server", () => {
	it("does not expose files outside its fixed asset list", async () => {
		const response = await handleActivityRequest(
			new Request("http://activity.test/.env"),
		);

		expect(response.status).toBe(404);
	});

	it("rejects methods that cannot serve a static asset", async () => {
		const response = await handleActivityRequest(
			new Request("http://activity.test/app.js", { method: "POST" }),
		);

		expect(response.status).toBe(405);
		expect(response.headers.get("allow")).toBe("GET, HEAD");
	});
});
