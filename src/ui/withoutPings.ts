/**
 * Stops a message from pinging anyone it mentions.
 * Unlike in embeds, mentions in Components V2 text displays ping.
 */
export function withoutPings<T extends object>(payload: T) {
	return { ...payload, allowedMentions: { parse: [] as [] } };
}
