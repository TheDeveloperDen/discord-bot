import { Message } from "discord.js";
import { logger } from "../logging.js";
import * as Sentry from "@sentry/bun";

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
