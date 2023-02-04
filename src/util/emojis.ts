import {Client, ComponentEmojiResolvable, GuildEmoji} from 'discord.js'


const isUnicodeEmoji = (char: string) => {
	return /\p{Extended_Pictographic}/u.test(char)
}
export const getEmoji = (client: Client, name: string) => {
	if (isUnicodeEmoji(name)) {
		return name
	}
	// try parse it as an id
	try {
		const id = BigInt(name)
		return client.emojis.resolve(id.toString())
	} catch (x) {
		// ignore bigint parse errors
	}

	return client.emojis.cache.find(emoji => emoji.name === name)
}

export const stringifyEmoji = (emoji: string | GuildEmoji) => {
	if (typeof emoji === 'string') {
		return emoji
	}
	return `<:${emoji.name}:${emoji.id}>`
}

export const toComponentEmojiResolvable: (emoji: (string | GuildEmoji)) => ComponentEmojiResolvable = emoji => {
	if (typeof emoji === 'string') {
		if (isUnicodeEmoji(emoji)) {
			return emoji
		}
		return `:${emoji}:`
	}
	return {
		id: emoji.id,
		name: emoji.name ?? undefined,
		animated: emoji.animated ?? undefined,
	}
}
