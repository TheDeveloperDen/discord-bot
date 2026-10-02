import type Module from "../module.js";
import { GitHubCommand } from "./github.command.js";

export const GitHubModule: Module = {
	name: "GitHub",
	commands: [GitHubCommand],
	globalCommands: [],
	listeners: [],
};

export default GitHubModule;
