import type Module from "../module.js";
import { DailyRewardCommand } from "./dailyReward.command.js";
import { scheduleAllReminders } from "./dailyReward.reminder.js";
import { LeaderboardCommand } from "./leaderboard.command.js";
import { ThreadListener } from "./threadStuff.listener.js";
import { XpCommand } from "./xp.command.js";
import { XpListener } from "./xp.listener.js";

export const XpModule: Module = {
	name: "xp",
	commands: [XpCommand, DailyRewardCommand, LeaderboardCommand],
	listeners: [XpListener, ThreadListener],
	onInit: async (_, client) => {
		await scheduleAllReminders(client);
	},
};
