import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	mock,
	test,
} from "bun:test";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { Client, User } from "discord.js";
import { GitHubService } from "../modules/github/github.service.js";
import {
	clearUserCache,
	DDUser,
	getOrCreateUserById,
} from "../store/models/DDUser.js";
import { getSequelizeInstance, initStorage } from "../store/storage.js";
import { createOAuthApp } from "./server.js";

const httpFetch = globalThis.fetch;
const originalGitHubClientId = process.env.GITHUB_CLIENT_ID;
const originalGitHubRedirectUri = process.env.GITHUB_REDIRECT_URI;

beforeAll(async () => {
	process.env.GITHUB_CLIENT_ID = "test-client";
	process.env.GITHUB_REDIRECT_URI = "https://example.test/auth/github/callback";
	await initStorage();
});

afterEach(async () => {
	await getSequelizeInstance().destroyAll();
	clearUserCache();
});

afterAll(() => {
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
	const app = createOAuthApp(client, oauthFetch);
	const server = app.listen(0, "127.0.0.1");
	await once(server, "listening");
	const { port } = server.address() as AddressInfo;

	try {
		return await httpFetch(
			`http://127.0.0.1:${port}/auth/github/callback?code=test-code&state=${state}`,
		);
	} finally {
		await new Promise<void>((resolve, reject) =>
			server.close((error) => (error ? reject(error) : resolve())),
		);
	}
}

function createGitHubOAuthFetch(
	githubId: string,
	githubUsername: string,
): typeof fetch {
	const oauthFetch = mock(async (input: RequestInfo | URL) => {
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

		expect(response.status).toBe(200);
		expect(await response.text()).toContain("Account Linked");
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

		expect(response.status).toBe(200);
		expect(await response.text()).toContain("Account Linked");
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

		expect(response.status).toBe(200);
		expect(await response.text()).toContain("Account Linked");
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
		expect(failedResponse.status).toBe(500);
		expect(fetchDiscordUser).not.toHaveBeenCalled();
		expect(await DDUser.findByPk(BigInt(discordUserId))).toMatchObject({
			githubId: "43",
			githubUsername: "hubot",
		});

		const successfulResponse = await requestOAuthCallback(
			client,
			state,
			oauthFetch,
		);
		expect(successfulResponse.status).toBe(200);
		expect(fetchDiscordUser).toHaveBeenCalledWith(discordUserId);
		expect(send).toHaveBeenCalledWith(
			"Your GitHub account **github-actions** has been linked to your Developer Den profile.",
		);
		expect(await DDUser.findByPk(BigInt(discordUserId))).toMatchObject({
			githubId: "44",
			githubUsername: "github-actions",
		});
	});
});
