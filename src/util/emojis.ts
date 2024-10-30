import {APIMessageComponentEmoji, Client, GuildEmoji} from 'discord.js'

const isUnicodeEmoji = (char: string): boolean => {
    return /\p{Extended_Pictographic}/u.test(char)
}

export function getEmoji(
    client: Client,
    name: string
): GuildEmoji | null | string {
    if (isUnicodeEmoji(name)) {
        return name
    }
    // try parse it as an id
    try {
        const id: bigint = BigInt(name)
        return client.emojis.resolve(id.toString())
    } catch (ignored) {
        // ignore bigint parse errors
        void ignored;
    }

    return client.emojis.cache.find((emoji) => emoji.name === name) ??
        `:${name}:`
}

export const stringifyEmoji = (emoji: string | GuildEmoji) => {
    if (typeof emoji === 'string') {
        return emoji
    }

    if (!emoji.name) {
        return `<:unknown:${emoji.id}>`
    }
    return `<:${emoji.name}:${emoji.id}>`
}

export function toAPIMessageComponentEmoji(
    emoji: string | GuildEmoji
): APIMessageComponentEmoji {
    if (typeof emoji === 'string') {
        if (isUnicodeEmoji(emoji)) {
            return {
                name: emoji
            }
        }
        return {
            name: emoji
        }
    }
    return {
        id: emoji.id,
        name: emoji.name ?? undefined,
        animated: emoji.animated ?? undefined
    }
}
