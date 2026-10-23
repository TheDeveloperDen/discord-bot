import { logger } from "../../logging.js";
import type Module from "../module.js";
import { GitHubAdminCommand, GitHubCommand } from "./github.command.js";
import { githubLinkingEnabled } from "./github.service.js";

if (!githubLinkingEnabled()) {
	logger.warn("WEBSITE_URL is not set, so GitHub linking is disabled");
}

export const GitHubModule: Module = {
	name: "GitHub",
	commands: githubLinkingEnabled() ? [GitHubCommand, GitHubAdminCommand] : [],
	globalCommands: [],
	listeners: [],
};

export default GitHubModule;
