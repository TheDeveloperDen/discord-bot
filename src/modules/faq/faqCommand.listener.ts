import { FAQ } from "../../store/models/FAQ.js";
import { awaitTimeout } from "../../util/timeouts.js";
import type { EventListener } from "../module.js";
import { renderFaq } from "./faq.render.js";

export const FaqCommandListener: EventListener = {
	async messageCreate(_, message) {
		if (!message.content.startsWith("?")) return;
		const arg = message.content.split(/ /)[0]?.substring(1);
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

		await message.reply(
			renderFaq(faq, {
				requester: message.author,
				member: message.member ?? undefined,
			}),
		);
	},
};
