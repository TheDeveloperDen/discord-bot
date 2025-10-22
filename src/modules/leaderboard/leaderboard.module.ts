import type Module from "../module.js";
import { LeaderboardCommand } from "./leaderboard.command.js";
import { LeaderboardListener } from "./leaderboard.listener.js";

export const LeaderboardModule: Module = {
	name: "leaderboard",
	commands: [LeaderboardCommand],
	listeners: [LeaderboardListener],
};

export default LeaderboardModule;
