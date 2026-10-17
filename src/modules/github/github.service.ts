import { randomBytes } from "node:crypto";

export interface GitHubState {
	userId: string;
	expiresAt: number;
}

class GitHubServiceInstance {
	private stateCache = new Map<string, GitHubState>();
	private readonly STATE_TTL = 10 * 60 * 1000; // 10 minutes

	public generateAuthUrl(userId: string): {
		url: string;
		state: string;
	} {
		const state = randomBytes(16).toString("hex");

		this.stateCache.set(state, {
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

	public getUserIdByState(state: string): string | null {
		const data = this.stateCache.get(state);
		if (!data) return null;

		if (Date.now() > data.expiresAt) {
			this.stateCache.delete(state);
			return null;
		}

		return data.userId;
	}

	public removeState(state: string) {
		this.stateCache.delete(state);
	}
}

export const GitHubService = new GitHubServiceInstance();
