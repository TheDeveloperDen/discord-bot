import type { Client } from "discord.js";
import { logger } from "../../logging.js";
import { DDUser, getOrCreateUserById } from "../../store/models/DDUser.js";
import { notifyGitHubLinkStatusChange } from "./github.notification.js";
import { type GitHubLinkOrigin, GitHubService } from "./github.service.js";

const RESULT_PATH = "/github/link";

type LinkResult =
	| "linked"
	| "expired"
	| "invalid"
	| "denied"
	| "already-linked"
	| "error";

/** Sends the browser to the nice pretty result page (on live site https://developerden.org/github/link/?...)  */
function redirectToResult(result: LinkResult, origin: GitHubLinkOrigin = {}) {
	const url = new URL(RESULT_PATH, process.env.WEBSITE_URL);
	url.searchParams.set("result", result);
	if (origin.channelId) {
		url.searchParams.set("guild", origin.guildId ?? "@me");
		url.searchParams.set("channel", origin.channelId);
	}
	return Response.redirect(url.toString(), 302);
}

export function githubRoutes(
	client: Pick<Client, "users">,
	fetchImpl: typeof fetch = fetch,
) {
	return {
		"/auth/github/callback": async (req: Request) => {
			const params = new URL(req.url).searchParams;
			const state = params.get("state");
			const code = params.get("code");

			if (!state) {
				return redirectToResult("invalid");
			}

			const linkState = GitHubService.getState(state);
			if (!linkState) {
				return redirectToResult("expired");
			}

			// start a completely new link
			GitHubService.removeState(state);
			const { userId: discordUserId, onLinked, ...origin } = linkState;

			if (!code) {
				return redirectToResult("denied", origin);
			}

			try {
				// Exchange code for access token
				const tokenResponse = await fetchImpl(
					"https://github.com/login/oauth/access_token",
					{
						method: "POST",
						headers: {
							Accept: "application/json",
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							client_id: process.env.GITHUB_CLIENT_ID,
							client_secret: process.env.GITHUB_CLIENT_SECRET,
							code,
						}),
					},
				);

				const tokenData = (await tokenResponse.json()) as {
					access_token?: string;
				};
				const accessToken = tokenData.access_token;

				if (!accessToken) {
					throw new Error(`GitHub API error: ${JSON.stringify(tokenData)}`);
				}

				// Fetch user profile
				const userResponse = await fetchImpl("https://api.github.com/user", {
					headers: {
						Authorization: `token ${accessToken}`,
						"User-Agent": "DevDenBot-OAuth-Integration",
					},
				});

				const userData = (await userResponse.json()) as {
					id: number | string;
					login: string;
				};
				const githubId = userData.id.toString();
				const githubUsername = userData.login;

				if (!githubId || !githubUsername) {
					throw new Error("Could not retrieve GitHub user identity.");
				}

				// Update Database
				const user = await getOrCreateUserById(BigInt(discordUserId));

				// Check if GitHub ID is already linked to another user
				const existingUser = await DDUser.findOne({
					where: { githubId: githubId },
				});
				if (existingUser && existingUser.id !== BigInt(discordUserId)) {
					return redirectToResult("already-linked", origin);
				}

				const previousGithubId = user.githubId;
				const previousGithubUsername = user.githubUsername;
				const linkStatusChanged =
					previousGithubId !== githubId ||
					previousGithubUsername !== githubUsername;
				user.githubId = githubId;
				user.githubUsername = githubUsername;
				try {
					await user.save();
				} catch (error) {
					user.githubId = previousGithubId;
					user.githubUsername = previousGithubUsername;
					throw error;
				}

				if (linkStatusChanged) {
					try {
						const discordUser = await client.users.fetch(discordUserId);
						await notifyGitHubLinkStatusChange(discordUser, {
							kind: "linked",
							githubUsername,
							replacedUsername:
								previousGithubId && previousGithubId !== githubId
									? previousGithubUsername
									: null,
						});
					} catch (error) {
						logger.error(
							`Could not notify Discord user ${discordUserId} of GitHub link change: ${error}`,
						);
					}
				}

				try {
					await onLinked?.(githubUsername);
				} catch (error) {
					// the link is already saved, so a stale reply in Discord isn't worth failing the page for
					logger.warn(`Could not update the GitHub link reply: ${error}`);
				}

				return redirectToResult("linked", origin);
			} catch (error) {
				logger.error(`GitHub OAuth Callback Error: ${error}`);
				return redirectToResult("error", origin);
			}
		},
	};
}
