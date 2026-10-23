import { randomBytes } from "node:crypto";

/** Where in Discord the link was started, so the website can send them back there */
export interface GitHubLinkOrigin {
	/** Absent when the command was run in a DM */
	guildId?: string;
	channelId?: string | null;
}

export interface GitHubState extends GitHubLinkOrigin {
	userId: string;
	/** Called once the account is linked, e.g. to update the message that held the authorise link */
	onLinked?: (githubUsername: string) => Promise<unknown>;
	expiresAt: number;
}

class GitHubServiceInstance {
	private stateCache = new Map<string, GitHubState>();
	private readonly STATE_TTL = 10 * 60 * 1000; // 10 minutes

	public generateAuthUrl(
		userId: string,
		options: GitHubLinkOrigin & Pick<GitHubState, "onLinked"> = {},
	): {
		url: string;
		state: string;
	} {
		const state = randomBytes(16).toString("hex");

		this.stateCache.set(state, {
			...options,
			userId,
			expiresAt: Date.now() + this.STATE_TTL,
		});

		const clientId = process.env.GITHUB_CLIENT_ID;
		const redirectUri = process.env.GITHUB_REDIRECT_URI;

		if (!clientId || !redirectUri) {
			throw new Error(
				"Missing GITHUB_CLIENT_ID or GITHUB_REDIRECT_URI in environment variables",
			);
		}

		const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}&scope=user`;

		return { url, state };
	}

	public getState(state: string): GitHubState | null {
		const data = this.stateCache.get(state);
		if (!data) return null;

		if (Date.now() > data.expiresAt) {
			this.stateCache.delete(state);
			return null;
		}

		return data;
	}

	public removeState(state: string) {
		this.stateCache.delete(state);
	}
}

export const GitHubService = new GitHubServiceInstance();

export const githubLinkingEnabled = () => Boolean(process.env.WEBSITE_URL);
