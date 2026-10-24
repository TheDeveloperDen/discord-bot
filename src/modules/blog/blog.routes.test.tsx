import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	mock,
	test,
} from "bun:test";
import type { Client } from "discord.js";
import {
	clearUserCache,
	getOrCreateUserById,
} from "../../store/models/DDUser.js";
import { getSequelizeInstance, initStorage } from "../../store/storage.js";
import { blogRoutes } from "./blog.routes.js";

const TOKEN = "test-token";
const originalToken = process.env.GITHUB_LOOKUP_TOKEN;

beforeAll(async () => {
	process.env.GITHUB_LOOKUP_TOKEN = TOKEN;
	await initStorage();
});

afterEach(async () => {
	await getSequelizeInstance().destroyAll();
	clearUserCache();
});

afterAll(() => {
	if (originalToken === undefined) delete process.env.GITHUB_LOOKUP_TOKEN;
	else process.env.GITHUB_LOOKUP_TOKEN = originalToken;
});

const post = (overrides: Record<string, unknown> = {}) => ({
	slug: "my-first-post",
	title: "My first post",
	authors: ["alice", "bob"],
	tags: ["java", "learning"],
	excerpt: "Today I **finally** worked out how classes work in Java.",
	...overrides,
});

function setup() {
	const startThread = mock(async (_options: unknown) => undefined);
	const send = mock(async (_message: unknown) => ({ startThread }));
	const client = {
		channels: { fetch: async () => ({ isSendable: () => true, send }) },
	} as unknown as Pick<Client, "channels">;
	const handler = blogRoutes(client)["/api/blog/announce"];
	if (!handler) throw new Error("route is not registered");
	const call = (body: unknown, token: string | null = TOKEN) =>
		handler(
			new Request("http://bot/api/blog/announce", {
				method: "POST",
				headers: token ? { authorization: `Bearer ${token}` } : {},
				body: JSON.stringify(body),
			}),
		);
	/** Every string under `name` (e.g. "content", "url") in the first message sent */
	const valuesOf = (name: string): string[] => {
		const found: string[] = [];
		const walk = (value: unknown) => {
			if (Array.isArray(value)) value.forEach(walk);
			else if (value && typeof value === "object") {
				for (const [key, child] of Object.entries(value)) {
					if (key === name && typeof child === "string") found.push(child);
					else walk(child);
				}
			}
		};
		walk(send.mock.calls[0]?.[0]);
		return found;
	};
	const textOf = () => valuesOf("content").join("\n");
	return { send, startThread, call, textOf, valuesOf };
}

describe("POST /api/blog/announce", () => {
	test("rejects a missing or wrong token", async () => {
		const { call, send } = setup();
		expect((await call({ posts: [post()] }, null)).status).toBe(401);
		expect((await call({ posts: [post()] }, "nope")).status).toBe(401);
		expect(send).not.toHaveBeenCalled();
	});

	test("rejects malformed posts without sending anything", async () => {
		const { call, send } = setup();
		const bad: unknown[] = [
			{},
			{ posts: [] },
			{ posts: "nope" },
			{ posts: [null] },
			{ posts: [post({ slug: "../etc/passwd" })] },
			{ posts: [post({ slug: "Has-Caps" })] },
			{ posts: [post({ title: "  " })] },
			{ posts: [post({ excerpt: undefined })] },
			{ posts: [post({ authors: ["bob](https://evil.example)"] })] },
			{ posts: [post({ tags: ["Not A Tag"] })] },
			{ posts: [post({ tags: Array(11).fill("tag") })] },
			// one bad post rejects the request
			{ posts: [post(), post({ slug: "BAD" })] },
			{ posts: Array.from({ length: 11 }, (_, i) => post({ slug: `p${i}` })) },
		];
		for (const body of bad) {
			expect((await call(body)).status).toBe(400);
		}
		expect(send).not.toHaveBeenCalled();
	});

	test("posts a card with the first author's avatar, a button to the website, and the rest in the footer", async () => {
		const alice = await getOrCreateUserById(1234n);
		alice.githubUsername = "Alice";
		await alice.save();
		const { call, send, textOf, valuesOf } = setup();

		const response = await call({ posts: [post()] });

		expect(response.status).toBe(200);
		expect(send).toHaveBeenCalledTimes(1);
		expect(send.mock.calls[0]?.[0]).toMatchObject({
			allowedMentions: { parse: [] },
		});
		const text = textOf();
		expect(text).toContain("## My first post");
		// the author is shown as a mention if they've linked their GitHub
		expect(text).toContain("<@1234>");
		// the excerpt's formatting is kept
		expect(text).toContain("Today I **finally** worked out");
		expect(text).toContain(
			"with [bob](https://github.com/bob) · `java` `learning`",
		);
		expect(valuesOf("url")).toEqual([
			"https://github.com/alice.png",
			"https://developerden.org/blog/my-first-post",
		]);
		expect(valuesOf("label")).toEqual(["Read the full post"]);
	});

	test("starts a thread named after the post for discussion", async () => {
		const { call, startThread } = setup();

		await call({ posts: [post({ title: `${"Long ".repeat(30)}title` })] });

		expect(startThread).toHaveBeenCalledTimes(1);
		// biome-ignore lint/style/noNonNullAssertion: test code doesn't matter
		const { name } = startThread.mock.calls[0]![0] as { name: string };
		expect(name.length).toBe(100);
		expect(name).toStartWith("Long Long");
	});

	test("still counts the post as announced if the thread can't be started", async () => {
		const { call, send, startThread } = setup();
		startThread.mockImplementationOnce(async () => {
			throw new Error("Missing Permissions");
		});

		const response = await call({ posts: [post()] });
		const again = await call({ posts: [post()] });

		expect(response.status).toBe(200);
		expect(await again.json()).toEqual({
			results: [{ slug: "my-first-post", posted: false, duplicate: true }],
		});
		expect(send).toHaveBeenCalledTimes(1);
	});

	test("links an author who hasn't linked their account to their GitHub", async () => {
		const { call, textOf } = setup();

		await call({ posts: [post({ authors: ["bob"], tags: [] })] });

		expect(textOf()).toContain("**[bob](https://github.com/bob)**");
		expect(textOf()).not.toContain("with");
	});

	test("shows the title as plain text, and keeps the excerpt short", async () => {
		const { call, textOf } = setup();

		await call({
			posts: [
				post({
					title: "Arrays [] in *C* [x](https://evil.example)",
					excerpt: `Intro\n\n${"x".repeat(2000)}`,
				}),
			],
		});

		const text = textOf();
		expect(text).toContain(
			"## Arrays \\[\\] in \\*C\\* \\[x\\](https://evil.example)",
		);
		expect(text).not.toContain("x".repeat(1501));
		expect(text.length).toBeLessThan(2000);
	});

	test("shows a post with no text and no authors", async () => {
		const { call, textOf } = setup();

		const response = await call({
			posts: [post({ excerpt: "", authors: [], tags: [] })],
		});

		expect(response.status).toBe(200);
		expect(textOf()).toContain("## My first post");
	});

	test("does not announce the same post twice", async () => {
		const { call, send } = setup();

		expect((await call({ posts: [post()] })).status).toBe(200);
		const again = await call({ posts: [post()] });

		expect(again.status).toBe(200);
		expect(await again.json()).toEqual({
			results: [{ slug: "my-first-post", posted: false, duplicate: true }],
		});
		expect(send).toHaveBeenCalledTimes(1);
	});

	test("reports a post that failed to send, announces the others, and allows a retry", async () => {
		const { call, send } = setup();
		send.mockImplementationOnce(async () => {
			throw new Error("Discord is down");
		});

		const response = await call({
			posts: [post({ slug: "first" }), post({ slug: "second" })],
		});

		expect(response.status).toBe(502);
		const { results } = (await response.json()) as {
			results: { slug: string; posted: boolean }[];
		};
		expect(results.map((r) => [r.slug, r.posted])).toEqual([
			["first", false],
			["second", true],
		]);

		const retry = await call({ posts: [post({ slug: "first" })] });
		expect(retry.status).toBe(200);
		expect(send).toHaveBeenCalledTimes(3);
	});
});
