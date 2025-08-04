import Module from "./module.js";
import { getOrCreateUserById } from "../store/models/DDUser.js";
import stringSimilarity from "string-similarity";
import { logger } from "../logging.js";
import { FAQ } from "../store/models/FAQ.js";
import { createFaqEmbed } from "./faq/faq.util.js";
import { tierOf } from "./xp/xpRoles.util.js";
import { isSpecialUser } from "../util/users.js";

const targets = [
  "i need help",
  "i have a problem",
  "help me please",
  "can anyone help me",
  "someone help me",
  "i have a question",
  "any java experts here",
].map((it) => it.toLowerCase());

export const AskToAskModule: Module = {
  name: "askToAsk",
  listeners: [
    {
      async messageCreate(_, message) {
        if (message.author.bot) return;
        if (message.member && isSpecialUser(message.member)) return;
        const ddUser = await getOrCreateUserById(BigInt(message.author.id));
        if (tierOf(ddUser.level) >= 2) return; // Hopefully they will have learned by now
        const c = message.content
          .toLowerCase()
          .trim()
          .replace(/[^a-z\d ]/g, "");
        if (!c) return;
        const words = c
          .split(/ /)
          .filter((s) => s.length > 1)
          .join(" ");
        const results = stringSimilarity.findBestMatch(words, targets);

        if (results.bestMatch.rating > 0.5) {
          const faq = await FAQ.findOne({ where: { name: "ask" } });
          if (faq == null) {
            logger.error("Could not find FAQ for ask");
            return;
          }
          await message.reply({ embeds: [createFaqEmbed(faq, undefined)] });
        }
      },
    },
  ],
};

export default AskToAskModule;
