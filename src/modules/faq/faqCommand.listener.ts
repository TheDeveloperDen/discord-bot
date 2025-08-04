import { FAQ } from "../../store/models/FAQ.js";
import { EventListener } from "../module.js";
import { createFaqEmbed } from "./faq.util.js";
import { awaitTimeout } from "../../util/timeouts.js";

export const FaqCommandListener: EventListener = {
  async messageCreate(_, message) {
    if (!message.content.startsWith("?")) return;
    const arg = message.content.split(/ /)[0]!.substring(1);
    if (!arg || arg.startsWith("?")) return;
    const faq = await FAQ.findOne({
      where: { name: arg },
    });
    if (faq == null) {
      const reply = await message.reply(`Could not find FAQ \`${arg}\``);
      await awaitTimeout(5000);
      await reply.delete();
      return;
    }

    const embed = createFaqEmbed(
      faq,
      message.author,
      message.member ?? undefined,
    );
    await message.reply({ embeds: [embed] });
  },
};
