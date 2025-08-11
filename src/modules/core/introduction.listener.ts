import { config } from "../../Config.js";
import { EventListener } from "../module.js";

export const IntroListener: EventListener = {
  messageCreate: async (_client, message) => {
    if (message.author.bot) return;
    if (message.channelId != config.channels.introductions) return;
    await message.react("👋");
    await message.startThread({
      name: `Welcome ${message.author.username}!`,
      reason: `Welcome to the server! Use this thread to discuss your introduction if you want, or come and say hi in <#${config.channels.general}>`,
    });
  },
};
