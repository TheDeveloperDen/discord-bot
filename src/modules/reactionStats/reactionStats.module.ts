import type Module from "../module.js";
import { ReactionStatsCommand } from "./reactionStats.command.js";
import { ReactionStatsListener } from "./reactionStats.listener.js";

export const ReactionStatsModule: Module = {
	name: "reactionStats",
	commands: [ReactionStatsCommand],
	listeners: [ReactionStatsListener],
};
