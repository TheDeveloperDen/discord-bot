import * as schedule from "node-schedule";
import type { EventListener } from "../module.js";

export const LeaderboardListener: EventListener = {
	clientReady: async (client) => {
		schedule.scheduleJob(
			{
				hour: 0,
				minute: 0,
				second: 0,
			},
			async () => {},
		);
	},
};
