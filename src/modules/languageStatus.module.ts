import Module from "./module.js";

import { logger } from "../logging.js";
import { awaitTimeout } from "../util/timeouts.js";
import { hotTakeData, hotTakeValue } from "./hotTakes/hotTakes.util.js";
import { ActivityType } from "discord.js";

export const LanguageStatusModule: Module = {
  name: "languageStatus",
  listeners: [
    {
      async ready(client, event) {
        while (client.isReady()) {
          const lang = hotTakeData.languages.randomElement();
          event.user.setActivity(`Coding in ${hotTakeValue(lang)}`, {
            type: ActivityType.Playing,
          });
          logger.info(`Set language status to ${hotTakeValue(lang)}`);
          await awaitTimeout(3.6e6);
        }
      },
    },
  ],
};
