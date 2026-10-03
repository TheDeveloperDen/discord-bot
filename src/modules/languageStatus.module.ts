import { ActivityType } from "discord.js";
import { getHotTakeData, takeItemValue } from "hot-takes";
import { config } from "../Config.js";
import { logger } from "../logging.js";
import randomElementFromArray from "../util/random.js";
import { awaitTimeout } from "../util/timeouts.js";
import type Module from "./module.js";

export const LanguageStatusModule: Module = {
	name: "languageStatus",
	listeners: [
		{
			async clientReady(client, event) {
				while (client.isReady()) {
					const customTexts = config.languageStatus?.texts;
					let status: string | undefined;

					if (customTexts && customTexts.length > 0) {
						status = randomElementFromArray(customTexts);
					} else {
						const lang = randomElementFromArray(getHotTakeData().languages);
						if (lang == null) {
							logger.error("No languages found in hot take data");
						} else {
							status = `Coding in ${takeItemValue(lang)}`;
						}
					}

					if (status != null) {
						event.user.setActivity(status, { type: ActivityType.Playing });
						logger.info(`Set status to ${status}`);
					}
					await awaitTimeout(3.6e6);
				}
			},
		},
	],
};
