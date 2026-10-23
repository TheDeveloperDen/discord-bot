import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	mock,
	test,
} from "bun:test";
import type { Client, User } from "discord.js";
import { GitHubService } from "../modules/github/github.service.js";
import {
	clearUserCache,
	DDUser,
	getOrCreateUserById,
} from "../store/models/DDUser.js";
import { getSequelizeInstance, initStorage } from "../store/storage.js";
import { createRoutes, markStarted } from "./server.js";

const httpFetch = globalThis.fetch;
const originalGitHubClientId = process.env.GITHUB_CLIENT_ID;
const originalGitHubRedirectUri = process.env.GITHUB_REDIRECT_URI;
const originalWebsiteUrl = process.env.WEBSITE_URL;

beforeAll(async () => {
	process.env.GITHUB_CLIENT_ID = "test-client";
	process.env.GITHUB_REDIRECT_URI = "https://example.test/auth/github/callback";
	process.env.WEBSITE_URL = "https://developerden.org";
	await initStorage();
});

afterEach(async () => {
	await getSequelizeInstance().destroyAll();
	clearUserCache();
});

afterAll(() => {
	if (originalWebsiteUrl === undefined) {
		delete process.env.WEBSITE_URL;
	} else {
		process.env.WEBSITE_URL = originalWebsiteUrl;
	}
	if (originalGitHubClientId === undefined) {
		delete process.env.GITHUB_CLIENT_ID;
	} else {
		process.env.GITHUB_CLIENT_ID = originalGitHubClientId;
	}
	if (originalGitHubRedirectUri === undefined) {
		delete process.env.GITHUB_REDIRECT_URI;
	} else {
		process.env.GITHUB_REDIRECT_URI = originalGitHubRedirectUri;
	}
});

async function requestOAuthCallback(
	client: Pick<Client, "users">,
	state: string,
	oauthFetch: typeof fetch,
): Promise<Response> {
	const server = Bun.serve({
		port: 0,
		hostname: "127.0.0.1",
		routes: createRoutes(client, oauthFetch),
	});

	try {
		return await httpFetch(
			`http://127.0.0.1:${server.port}/auth/github/callback?code=test-code&state=${state}`,
			{ redirect: "manual" },
		);
	} finally {
		await server.stop(true);
	}
}

const resultOf = (response: Response) =>
	new URL(response.headers.get("location") ?? "").searchParams.get("result");

function createGitHubOAuthFetch(
	githubId: string,
	githubUsername: string,
): typeof fetch {
	const oauthFetch = mock(async (input: string | URL | Request) => {
		const url = input.toString();
		if (url === "https://github.com/login/oauth/access_token") {
			return Response.json({ access_token: "test-access-token" });
		}
		if (url === "https://api.github.com/user") {
			return Response.json({ id: githubId, login: githubUsername });
		}
		throw new Error(`Unexpected OAuth request: ${url}`);
	});
	return oauthFetch as unknown as typeof fetch;
}

describe("GitHub OAuth callback notifications", () => {
	test("persists a changed link and notifies its Discord user", async () => {
		const discordUserId = "123456789";
		const send = mock(async () => {
			expect(await DDUser.findByPk(BigInt(discordUserId))).toMatchObject({
				githubId: "42",
				githubUsername: "octocat",
			});
		});
		const recipient = { id: discordUserId, send } as unknown as User;
		const fetchDiscordUser = mock(async () => recipient);
		const client = {
			users: { fetch: fetchDiscordUser },
		} as unknown as Pick<Client, "users">;
		const { state } = GitHubService.generateAuthUrl(discordUserId);
		const oauthFetch = createGitHubOAuthFetch("42", "octocat");

		const response = await requestOAuthCallback(client, state, oauthFetch);

		expect(response.status).toBe(302);
		expect(resultOf(response)).toBe("linked");
		expect(fetchDiscordUser).toHaveBeenCalledWith(discordUserId);
		expect(send).toHaveBeenCalledTimes(1);
		expect(await DDUser.findByPk(BigInt(discordUserId))).toMatchObject({
			githubId: "42",
			githubUsername: "octocat",
		});
	});

	test("does not notify an unchanged OAuth reauthorization", async () => {
		const discordUserId = "123456790";
		const user = await getOrCreateUserById(BigInt(discordUserId));
		user.githubId = "42";
		user.githubUsername = "octocat";
		await user.save();
		const fetchDiscordUser = mock(async () => {
			throw new Error("should not fetch a recipient");
		});
		const client = {
			users: { fetch: fetchDiscordUser },
		} as unknown as Pick<Client, "users">;
		const { state } = GitHubService.generateAuthUrl(discordUserId);
		const oauthFetch = createGitHubOAuthFetch("42", "octocat");

		const response = await requestOAuthCallback(client, state, oauthFetch);

		expect(response.status).toBe(302);
		expect(resultOf(response)).toBe("linked");
		expect(fetchDiscordUser).not.toHaveBeenCalled();
	});

	test("keeps the successful response and persisted link when recipient lookup fails", async () => {
		const discordUserId = "123456791";
		const fetchDiscordUser = mock(async () => {
			throw new Error("Discord API unavailable");
		});
		const client = {
			users: { fetch: fetchDiscordUser },
		} as unknown as Pick<Client, "users">;
		const { state } = GitHubService.generateAuthUrl(discordUserId);
		const oauthFetch = createGitHubOAuthFetch("43", "hubot");

		const response = await requestOAuthCallback(client, state, oauthFetch);

		expect(response.status).toBe(302);
		expect(resultOf(response)).toBe("linked");
		expect(fetchDiscordUser).toHaveBeenCalledWith(discordUserId);
		expect(await DDUser.findByPk(BigInt(discordUserId))).toMatchObject({
			githubId: "43",
			githubUsername: "hubot",
		});
	});

	test("notifies when a changed-account retry succeeds after a failed save", async () => {
		const discordUserId = "123456792";
		const user = await getOrCreateUserById(BigInt(discordUserId));
		user.githubId = "43";
		user.githubUsername = "hubot";
		await user.save();
		const persistedSave = user.save.bind(user);
		let failNextSave = true;
		user.save = mock(async () => {
			if (failNextSave) {
				failNextSave = false;
				throw new Error("Database write failed");
			}
			return await persistedSave();
		}) as typeof user.save;

		const send = mock(async () => undefined);
		const recipient = { id: discordUserId, send } as unknown as User;
		const fetchDiscordUser = mock(async () => recipient);
		const client = {
			users: { fetch: fetchDiscordUser },
		} as unknown as Pick<Client, "users">;
		const { state } = GitHubService.generateAuthUrl(discordUserId);
		const oauthFetch = createGitHubOAuthFetch("44", "github-actions");

		const failedResponse = await requestOAuthCallback(
			client,
			state,
			oauthFetch,
		);
		expect(failedResponse.status).toBe(302);
		expect(resultOf(failedResponse)).toBe("error");
		expect(fetchDiscordUser).not.toHaveBeenCalled();
		expect(await DDUser.findByPk(BigInt(discordUserId))).toMatchObject({
			githubId: "43",
			githubUsername: "hubot",
		});

		// the state is one-shot, so a retry starts a new link
		const retry = GitHubService.generateAuthUrl(discordUserId);
		const successfulResponse = await requestOAuthCallback(
			client,
			retry.state,
			oauthFetch,
		);
		expect(successfulResponse.status).toBe(302);
		expect(resultOf(successfulResponse)).toBe("linked");
		expect(fetchDiscordUser).toHaveBeenCalledWith(discordUserId);
		expect(send).toHaveBeenCalledWith(
			"Your GitHub account **github-actions** has been linked to your Developer Den profile, replacing **hubot**.",
		);
		expect(await DDUser.findByPk(BigInt(discordUserId))).toMatchObject({
			githubId: "44",
			githubUsername: "github-actions",
		});
	});
});

describe("GitHub OAuth callback state and notifications", () => {
	const client = () =>
		({
			users: { fetch: mock(async () => ({ send: async () => undefined })) },
		}) as unknown as Pick<Client, "users">;

	test("a replayed state is expired", async () => {
		const { state } = GitHubService.generateAuthUrl("123456800");
		const oauthFetch = createGitHubOAuthFetch("50", "first");

		expect(
			resultOf(await requestOAuthCallback(client(), state, oauthFetch)),
		).toBe("linked");
		expect(
			resultOf(await requestOAuthCallback(client(), state, oauthFetch)),
		).toBe("expired");
	});

	test("a denied authorisation uses up the state", async () => {
		const { state } = GitHubService.generateAuthUrl("123456801");
		const server = Bun.serve({
			port: 0,
			hostname: "127.0.0.1",
			routes: createRoutes(client()),
		});
		try {
			const url = `http://127.0.0.1:${server.port}/auth/github/callback?state=${state}`;
			const first = await httpFetch(url, { redirect: "manual" });
			const second = await httpFetch(url, { redirect: "manual" });
			expect(resultOf(first)).toBe("denied");
			expect(resultOf(second)).toBe("expired");
		} finally {
			await server.stop(true);
		}
	});

	test("notifies when a user links a different account, naming the one replaced", async () => {
		const user = await getOrCreateUserById(123456802n);
		user.githubId = "60";
		user.githubUsername = "old-account";
		await user.save();
		const send = mock(async () => undefined);
		const { state } = GitHubService.generateAuthUrl("123456802");

		await requestOAuthCallback(
			{ users: { fetch: async () => ({ send }) } } as unknown as Pick<
				Client,
				"users"
			>,
			state,
			createGitHubOAuthFetch("61", "new-account"),
		);

		expect(send).toHaveBeenCalledWith(
			"Your GitHub account **new-account** has been linked to your Developer Den profile, replacing **old-account**.",
		);
	});
});

describe("GitHub user lookup API", () => {
	const TOKEN = "test-lookup-token";
	const discordUser = {
		id: "123456900",
		displayName: "Octo Cat",
		displayAvatarURL: () => "https://cdn.example/avatar.png",
	};

	async function lookup(
		username: string,
		headers: Record<string, string> = {},
	) {
		const server = Bun.serve({
			port: 0,
			hostname: "127.0.0.1",
			routes: createRoutes({
				users: { fetch: async () => discordUser },
			} as unknown as Pick<Client, "users">),
		});
		try {
			return await httpFetch(
				`http://127.0.0.1:${server.port}/api/github/${username}`,
				{ headers },
			);
		} finally {
			await server.stop(true);
		}
	}

	const authed = { Authorization: `Bearer ${TOKEN}` };

	beforeAll(() => {
		process.env.GITHUB_LOOKUP_TOKEN = TOKEN;
	});
	afterAll(() => {
		delete process.env.GITHUB_LOOKUP_TOKEN;
	});

	test("returns the display name, avatar and level, ignoring username case", async () => {
		const user = await getOrCreateUserById(123456900n);
		user.githubId = "70";
		user.githubUsername = "Octocat";
		user.level = 7;
		await user.save();

		const response = await lookup("octocat", authed);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			discordId: "123456900",
			displayName: "Octo Cat",
			avatarUrl: "https://cdn.example/avatar.png",
			level: 7,
		});
	});

	test("refuses a missing or wrong token without revealing whether the user exists", async () => {
		const user = await getOrCreateUserById(123456901n);
		user.githubId = "71";
		user.githubUsername = "secret-linker";
		await user.save();

		expect((await lookup("secret-linker")).status).toBe(401);
		expect(
			(await lookup("secret-linker", { Authorization: "Bearer nope" })).status,
		).toBe(401);
		expect((await lookup("nobody")).status).toBe(401);
	});

	test("404s for a username nobody linked", async () => {
		expect((await lookup("nobody", authed)).status).toBe(404);
	});

	test("does not exist when no token is configured", async () => {
		delete process.env.GITHUB_LOOKUP_TOKEN;
		try {
			expect((await lookup("octocat", authed)).status).toBe(404);
		} finally {
			process.env.GITHUB_LOOKUP_TOKEN = TOKEN;
		}
	});
});

describe("web server routes", () => {
	test("reports unhealthy until the bot has started", async () => {
		const server = Bun.serve({
			port: 0,
			hostname: "127.0.0.1",
			routes: createRoutes({} as Pick<Client, "users">),
		});
		try {
			const url = `http://127.0.0.1:${server.port}/health`;
			expect((await httpFetch(url)).status).toBe(503);
			markStarted();
			expect((await httpFetch(url)).status).toBe(200);
		} finally {
			await server.stop(true);
		}
	});

	test("serves the health check", async () => {
		const server = Bun.serve({
			port: 0,
			hostname: "127.0.0.1",
			routes: createRoutes({} as Pick<Client, "users">),
		});
		try {
			const health = await httpFetch(`http://127.0.0.1:${server.port}/health`);
			expect(await health.text()).toBe("OK");
		} finally {
			await server.stop(true);
		}
	});

	test("sends the person back to the channel they started the link in", async () => {
		const client = {
			users: { fetch: mock(async () => ({ send: async () => undefined })) },
		} as unknown as Pick<Client, "users">;
		const { state } = GitHubService.generateAuthUrl("123456792", {
			guildId: "111",
			channelId: "222",
		});

		const response = await requestOAuthCallback(
			client,
			state,
			createGitHubOAuthFetch("45", "dependabot"),
		);

		const location = new URL(response.headers.get("location") ?? "");
		expect(location.origin + location.pathname).toBe(
			"https://developerden.org/github/link",
		);
		expect(Object.fromEntries(location.searchParams)).toEqual({
			result: "linked",
			guild: "111",
			channel: "222",
		});
	});

	test("uses @me as the guild for a DM", async () => {
		const client = {
			users: { fetch: mock(async () => ({ send: async () => undefined })) },
		} as unknown as Pick<Client, "users">;
		const { state } = GitHubService.generateAuthUrl("123456793", {
			guildId: undefined,
			channelId: "333",
		});

		const response = await requestOAuthCallback(
			client,
			state,
			createGitHubOAuthFetch("46", "renovate"),
		);

		const params = new URL(response.headers.get("location") ?? "").searchParams;
		expect(params.get("guild")).toBe("@me");
		expect(params.get("channel")).toBe("333");
	});

	test("leaves the GitHub callback out when WEBSITE_URL is unset", async () => {
		delete process.env.WEBSITE_URL;
		try {
			expect(createRoutes({} as Pick<Client, "users">)).not.toHaveProperty(
				"/auth/github/callback",
			);
		} finally {
			process.env.WEBSITE_URL = "https://developerden.org";
		}
	});

	test("reports an unknown state as expired, with no origin", async () => {
		const response = await requestOAuthCallback(
			{} as Pick<Client, "users">,
			"not-a-real-state",
			createGitHubOAuthFetch("47", "nobody"),
		);

		const params = new URL(response.headers.get("location") ?? "").searchParams;
		expect(Object.fromEntries(params)).toEqual({ result: "expired" });
	});

	test("tells the link's owner it worked, and survives that failing", async () => {
		const client = {
			users: { fetch: mock(async () => ({ send: async () => undefined })) },
		} as unknown as Pick<Client, "users">;
		const onLinked = mock(async () => {
			throw new Error("Unknown Webhook");
		});
		const { state } = GitHubService.generateAuthUrl("123456794", { onLinked });

		const response = await requestOAuthCallback(
			client,
			state,
			createGitHubOAuthFetch("48", "mona"),
		);

		expect(onLinked).toHaveBeenCalledWith("mona");
		expect(resultOf(response)).toBe("linked");
	});

	test("does not call onLinked when the link fails", async () => {
		const onLinked = mock(async () => undefined);
		const { state } = GitHubService.generateAuthUrl("123456795", { onLinked });
		const oauthFetch = mock(async () =>
			Response.json({ error: "bad_verification_code" }),
		) as unknown as typeof fetch;

		const response = await requestOAuthCallback(
			{} as Pick<Client, "users">,
			state,
			oauthFetch,
		);

		expect(resultOf(response)).toBe("error");
		expect(onLinked).not.toHaveBeenCalled();
	});
});
