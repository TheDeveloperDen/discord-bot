import { EventListener } from "../module.js";
import * as schedule from "node-schedule";
import { logger } from "@sentry/bun";
import {
  ModeratorAction,
  ModeratorActions,
} from "../../store/models/ModeratorActions.js";
import { Op } from "@sequelize/core";
import { config } from "../../Config.js";

export const TempBanListener: EventListener = {
  clientReady: async (client) => {
    schedule.scheduleJob(
      {
        minute: 0,
        second: 0,
      },
      async function () {
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
          console.log(
            `Processing expired temp ban for user ${tempBan.dduserId}`,
          );

          await guild.bans.remove(
            tempBan.dduserId.toString(),
            "Temp Ban Expired",
          );
          const auditLogChannel = await guild.channels.fetch(
            config.channels.auditLog,
          );

          if (auditLogChannel?.isSendable()) {
            await auditLogChannel.send(`Unbanned ${tempBan.dduserId})`);
          }

          // Mark as expired
          await tempBan.update({ expired: true });

          // Add your logic here to actually unban the user
          // For example:
          // const guild = client.guilds.cache.get(guildId);
          // await guild?.bans.remove(tempBan.dduserId);

          logger.info(
            `Processed expired temp ban for user ${tempBan.dduserId}`,
          );
        }
      },
    );
  },
};
