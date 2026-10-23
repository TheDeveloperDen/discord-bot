import { MessageFlags } from "discord.js";
import { Message, renderDiscordMessage } from "disjsx";
import type { ReactElement } from "react";

/** Renders a card (or any V2 content) as a Components V2 message payload only the invoker can see */
export function ephemeral(content: ReactElement) {
	const payload = renderDiscordMessage(<Message isV2>{content}</Message>);
	return { ...payload, flags: (payload.flags ?? 0) | MessageFlags.Ephemeral };
}
