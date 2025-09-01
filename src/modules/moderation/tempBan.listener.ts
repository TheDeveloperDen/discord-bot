import { Op } from "@sequelize/core";
import * as schedule from "node-schedule";
import { config } from "../../Config.js";
import { logger } from "../../logging.js";
import {
	ModeratorAction,
	ModeratorActions,
} from "../../store/models/ModeratorActions.js";
import type { EventListener } from "../module.js";
import { logModerationAction } from "./logs.js";

export const TempBanListener: EventListener = {
	clientReady: async (client) => {
		schedule.scheduleJob(
			{
				minute: 0,
				second: 0,
			},
			async () => {
				logger.info("Starting Temp Ban Checks...");
				const tempBans = await ModeratorActions.findAll({
					where: {
						action: ModeratorAction.TEMPBAN,
						expired: false,
						expires: {
							[Op.lt]: new Date(), // expires is less than current time
						},
					},
				});
				const guild = await client.guilds.fetch(config.guildId);

				// Process the expired temp bans
				for (const tempBan of tempBans) {
					logger.info(
						`Processing expired temp ban for user %s`,
						tempBan.ddUserId,
					);

					await guild.bans.remove(
						tempBan.ddUserId.toString(),
						"Temp Ban Expired",
					);

					await logModerationAction(client, {
						kind: "TempBanEnded",
						target: tempBan.ddUserId.toString(),
					});

					// Mark as expired
					await tempBan.update({ expired: true });

					// Add your logic here to actually unban the user
					// For example:
					// const guild = client.guilds.cache.get(guildId);
					// await guild?.bans.remove(tempBan.dduserId);

					logger.info(
						`Processed expired temp ban for user ${tempBan.ddUserId}`,
					);
				}
			},
		);
	},
};
