import { ActivityType } from "discord.js";
import { getHotTakeData, takeItemValue } from "hot-takes";
import { logger } from "../logging.js";
import randomElementFromArray from "../util/random.js";
import { awaitTimeout } from "../util/timeouts.js";
import type Module from "./module.js";

export const LanguageStatusModule: Module = {
	name: "languageStatus",
	listeners: [
		{
			async ready(client, event) {
				while (client.isReady()) {
					const lang = randomElementFromArray(getHotTakeData().languages);
					if (lang == null) {
						logger.error("No languages found in hot take data");
						continue;
					}
					event.user.setActivity(`Coding in ${takeItemValue(lang)}`, {
						type: ActivityType.Playing,
					});
					logger.info(`Set language status to ${takeItemValue(lang)}`);
					await awaitTimeout(3.6e6);
				}
			},
		},
	],
};
