import express from "express";
import { logger } from "../logging.js";
import { GitHubService } from "../modules/github/github.service.js";
import { DDUser, getOrCreateUserById } from "../store/models/DDUser.js";

const app = express();

function renderPage(
	res: express.Response,
	title: string,
	heading: string,
	message: string,
	opts?: {
		status?: number;
		icon?: string;
		iconColor?: string;
		hint?: string;
	},
) {
	const { status = 200, icon, iconColor = "#333", hint } = opts ?? {};

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>${title}</title>
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
			display: flex;
			justify-content: center;
			align-items: center;
			min-height: 100vh;
			background: #0d1117;
			color: #e6edf3;
		}
		.card {
			background: #161b22;
			border: 1px solid #30363d;
			border-radius: 4px;
			padding: 2.5rem 2rem;
			max-width: 380px;
			width: 100%;
			text-align: center;
		}
		.icon {
			font-size: 1.5rem;
			line-height: 1;
			margin-bottom: 1rem;
			color: ${iconColor};
		}
		h1 {
			font-size: 1.15rem;
			font-weight: 600;
			color: #e6edf3;
			margin-bottom: 0.5rem;
		}
		.message {
			font-size: 0.875rem;
			color: #8b949e;
			line-height: 1.5;
		}
		.hint {
			font-size: 0.75rem;
			color: #6e7681;
			margin-top: 0.75rem;
		}
	</style>
</head>
<body>
	<div class="card">
		${icon ? `<div class="icon">${icon}</div>` : ""}
		<h1>${heading}</h1>
		<p class="message">${message}</p>
		${hint ? `<p class="hint">${hint}</p>` : ""}
	</div>
</body>
</html>`;

	res.status(status).send(html);
}

export async function startOAuthServer() {
	const port = parseInt(process.env.OAUTH_PORT || "3000", 10);

	app.get("/auth/github/callback", async (req, res) => {
		const { code, state } = req.query;

		if (!state || typeof state !== "string") {
			return renderPage(
				res,
				"Error",
				"Invalid Request",
				"Missing or invalid state parameter.",
				{
					status: 400,
					icon: "&#x26A0;",
					iconColor: "#d29922",
					hint: "Try running the link command again in Discord.",
				},
			);
		}

		const discordUserId = GitHubService.getUserIdByState(state);
		if (!discordUserId) {
			return renderPage(
				res,
				"Error",
				"Link Expired",
				"This authorization link has expired or is invalid.",
				{
					status: 400,
					icon: "&#x23F0;",
					iconColor: "#d29922",
					hint: "Please start the linking process again from Discord.",
				},
			);
		}

		if (!code || typeof code !== "string") {
			return renderPage(
				res,
				"Error",
				"Authorization Failed",
				"No authorization code received from GitHub.",
				{
					status: 400,
					icon: "&#x26A0;",
					iconColor: "#d29922",
					hint: "You may have denied the permission request. Try again from Discord.",
				},
			);
		}

		try {
			// 1. Exchange code for access token
			const tokenResponse = await fetch(
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
						code: code,
					}),
				},
			);

			const tokenData = await tokenResponse.json();
			const accessToken = tokenData.access_token;

			if (!accessToken) {
				throw new Error(`GitHub API error: ${JSON.stringify(tokenData)}`);
			}

			// 2. Fetch user profile
			const userResponse = await fetch("https://api.github.com/user", {
				headers: {
					Authorization: `token ${accessToken}`,
					"User-Agent": "DevDenBot-OAuth-Integration",
				},
			});

			const userData = await userResponse.json();
			const githubId = userData.id.toString();
			const githubUsername = userData.login;

			if (!githubId || !githubUsername) {
				throw new Error("Could not retrieve GitHub user identity.");
			}

			// 3. Update Database
			const user = await getOrCreateUserById(BigInt(discordUserId));

			// Check if GitHub ID is already linked to another user
			const existingUser = await DDUser.findOne({
				where: { githubId: githubId },
			});
			if (existingUser && existingUser.id !== BigInt(discordUserId)) {
				return renderPage(
					res,
					"Error",
					"Already Linked",
					"This GitHub account is already linked to another Discord user.",
					{
						status: 400,
						icon: "&#x1F512;",
						iconColor: "#d29922",
						hint: "Each GitHub account can only be linked to one Discord account.",
					},
				);
			}

			user.githubId = githubId;
			user.githubUsername = githubUsername;
			await user.save();

			GitHubService.removeState(state);

			renderPage(
				res,
				"GitHub Linked",
				"Account Linked",
				`Your GitHub account <strong>${githubUsername}</strong> has been linked to your Discord profile.`,
				{
					icon: "&#x2713;",
					iconColor: "#3fb950",
					hint: "You can now close this window and return to Discord.",
				},
			);
		} catch (error) {
			logger.error(`GitHub OAuth Callback Error: ${error}`);
			renderPage(
				res,
				"Error",
				"Something Went Wrong",
				"An internal error occurred while linking your account.",
				{
					status: 500,
					icon: "&#x2717;",
					iconColor: "#f85149",
					hint: "Please try again later. If the problem persists, contact a server admin.",
				},
			);
		}
	});

	const server = app.listen(port, () => {
		logger.info(`OAuth server listening on port ${port}`);
	});

	server.on("error", (err: Error) => {
		logger.error(`OAuth server failed to start: ${err.message}`);
	});
}
