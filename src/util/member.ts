import * as Sentry from "@sentry/bun";
import type { Message } from "discord.js";
import { logger } from "../logging.js";

export async function getMember(message: Message) {
	if (!message.inGuild()) return null;

	if (message.member) {
		return message.member;
	}

	try {
		return await message.guild.members.fetch(message.author.id);
	} catch (error) {
		logger.error("Failed to fetch member:", error);
		Sentry.captureException(error);
	}
}
