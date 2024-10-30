import {GuildMember, PartialGuildMember, User} from 'discord.js'
import {config} from '../Config.js'

export const userShouldBePinged = (
    user: GuildMember | PartialGuildMember
): boolean =>
    !user.roles.cache.has(
        config.roles.noPing
    )

export const pseudoMention = (user: User): string =>
    user.discriminator === '0' ? user.username : `${user.username}#${user.discriminator}`

export const mention = (
    user: GuildMember | User | PartialGuildMember
): string => {
    if (user instanceof User) {
        return actualMention(user)
    } else {
        return userShouldBePinged(user)
            ? actualMention(user)
            : pseudoMention(
                user.user
            )
    }
}
export const actualMention = (
    user: GuildMember | User | PartialGuildMember
): string => `<@${user.id}>`

export const mentionWithNoPingMessage = (user: GuildMember): string =>
    userShouldBePinged(user)
        ? `<@${user.id}> (Don't want to be pinged? </no-ping:1300906483403325490>)`
        : pseudoMention(user.user)

export const isSpecialUser = (user: GuildMember): boolean =>
    user.premiumSinceTimestamp !=
    null ||
    user.roles.cache.has(config.roles.staff) ||
    user.roles.cache.has(config.roles.notable ?? '') ||
    user.roles.cache.has('1185946490984738938')
