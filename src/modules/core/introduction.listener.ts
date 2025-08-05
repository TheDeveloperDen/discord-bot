import { config } from "../../Config.js";
import { EventListener } from "../module.js";

export const IntroListener: EventListener = {
  messageCreate: async (_client, message) => {
    if (message.author.bot) return;
    if (message.channelId != config.channels.introductions) return;
    await message.startThread({
      name: `Welcome ${message.author.username}!`,
    });
  },
};
