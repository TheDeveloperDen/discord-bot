import {GuildMember, User} from "discord.js";

const noPingId = '848197427617595393'
export const userShouldBePinged = (user: GuildMember) => !user.roles.cache.has(noPingId)

export const pseudoMention = (user: User) => `${user.username}#${user.discriminator}`

export const mention = (user: GuildMember) =>
    userShouldBePinged(user) ? `<@${user.id}>` : pseudoMention(user.user)

export const mentionWithNoPingMessage = (user: GuildMember) =>
    userShouldBePinged(user) ? `<@${user.id}> (Don't want to be pinged? **/role No Ping**)` : pseudoMention(user.user)