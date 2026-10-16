import { type GuildMember, MessageFlags, type User } from "discord.js";
import { Message, renderDiscordMessage } from "disjsx";
import type { FAQ } from "../../store/models/FAQ.js";
import { Card, memberAuthor, withoutPings } from "../../ui/index.js";
import { fakeMention } from "../../util/users.js";

interface RenderFaqOptions {
	/** Who asked for it, shown in the footer */
	requester?: User;
	/** The requester as a member, so the card takes their role colour */
	member?: GuildMember;
	ephemeral?: boolean;
}

/** A FAQ entry as a Components V2 card */
export function renderFaq(
	faq: FAQ,
	{ requester, member, ephemeral }: RenderFaqOptions = {},
) {
	return withoutPings(
		renderDiscordMessage(
			<Message isV2 flags={ephemeral ? MessageFlags.Ephemeral : undefined}>
				<Card
					accent={member ? memberAuthor(member).color : undefined}
					title={faq.title}
					description={faq.content}
					footer={
						requester
							? `Requested by ${fakeMention(requester)} | ${faq.name}`
							: faq.name
					}
				/>
			</Message>,
		),
	);
}
