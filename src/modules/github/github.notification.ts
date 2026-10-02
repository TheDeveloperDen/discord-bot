import type { User } from "discord.js";
import { logger } from "../../logging.js";

export type GitHubLinkStatusChange =
	| { kind: "linked"; githubUsername: string }
	| {
			kind: "unlinked";
			githubUsername: string;
			actor: "self" | "administrator";
	  };

export async function notifyGitHubLinkStatusChange(
	user: User,
	change: GitHubLinkStatusChange,
): Promise<void> {
	const content =
		change.kind === "linked"
			? `Your GitHub account **${change.githubUsername}** has been linked to your Developer Den profile.`
			: change.actor === "administrator"
				? `Your GitHub account **${change.githubUsername}** has been unlinked from your Developer Den profile by an administrator.`
				: `Your GitHub account **${change.githubUsername}** has been unlinked from your Developer Den profile.`;

	try {
		await user.send(content);
	} catch (error) {
		logger.warn(
			`Failed to send GitHub ${change.kind} notification to ${user.id}`,
			error,
		);
	}
}
