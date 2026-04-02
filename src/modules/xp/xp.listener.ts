import type { Channel } from "discord.js";
import { config } from "../../Config.js";
import { logger } from "../../logging.js";
import { wrapInTransaction } from "../../sentry.js";
import type { EventListener } from "../module.js";
import {
	giveXp,
	shouldCountForStats,
	xpForMessage,
} from "./xpForMessage.util.js";

export const XpListener: EventListener = {
	messageCreate: wrapInTransaction("messageCreate", async (_, _client, msg) => {
		if (msg.guild == null) return;
		const author = msg.member;
		if (!author) return;

		const shouldCount = await shouldCountForStats(
			msg.author,
			msg,
			msg.channel as Channel,
			config,
		);
		if (shouldCount) {
			logger.debug(`counting message ${msg.id} for XP for ${msg.author.id}`);
			const xp = xpForMessage(msg.content);
			await giveXp(author, xp);
		}
	}),
};
