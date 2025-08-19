import Module from "./module.js";

import { logger } from "../logging.js";
import { awaitTimeout } from "../util/timeouts.js";
import { hotTakeData, hotTakeValue } from "./hotTakes/hotTakes.util.js";
import { ActivityType } from "discord.js";
import randomElementFromArray from "../util/random.js";

export const LanguageStatusModule: Module = {
  name: "languageStatus",
  listeners: [
    {
      async ready(client, event) {
        while (client.isReady()) {
          const lang = randomElementFromArray(hotTakeData.languages);
          if (lang == null) {
            logger.error("No languages found in hot take data");
            continue;
          }
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
