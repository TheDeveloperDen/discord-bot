import { Client, GuildMember, TextChannel } from 'discord.js'
import { DDUser } from '../../store/models/DDUser.js'
import { modifyRoles } from '../../util/roles.js'
import { config } from '../../Config.js'
import { createStandardEmbed } from '../../util/embeds.js'
import { actualMention, mentionWithNoPingMessage, pseudoMention } from '../../util/users.js'
import { tierRoleId, xpForLevel } from './xpForMessage.util.js'
import { logger } from '../../logging.js'

export async function levelUp (
  client: Client,
  user: GuildMember,
  ddUser: DDUser
) {
  let level = ddUser.level
  while (ddUser.xp >= xpForLevel(level + 1)) {
    level++
    logger.info(
      `${ddUser.id} xp (${ddUser.xp}) was enough to level up to ${level} (${
        xpForLevel(
          level
        )
      })`
    )
  }
  if (level === ddUser.level) {
    return
  }
  ddUser.level = level
  logger.info(`${ddUser.id} leveling up to ${level}`)
  await applyTierRoles(client, user, ddUser)
  await sendLevelUpMessage(client, user, ddUser)
}

async function applyTierRoles (
  client: Client,
  user: GuildMember,
  ddUser: DDUser
) {
  const tier = tierRoleId(ddUser.level)
  await modifyRoles(client, user, {
    toAdd: [tier],
    toRemove: config.roles.tiers.filter((it) => it !== tier)
  })
}

async function sendLevelUpMessage (
  client: Client,
  member: GuildMember,
  ddUser: DDUser
) {
  const user = member.user
  const channel = await client.channels.fetch(
    config.channels.botCommands
  ) as TextChannel
  if (!channel) {
    console.error(
      `Could not find level up channel with id ${config.channels.botCommands}`
    )
    return
  }
  const embed = createStandardEmbed(member)
    .setTitle('⚡ Level Up!')
    .setAuthor({
      name: pseudoMention(user),
      iconURL: user.avatarURL() ?? undefined
    })
    .setFields({
      name: '📈 XP',
      value: `${ddUser.xp}/${xpForLevel(ddUser.level + 1)}`
    })
    .setDescription(
      `${actualMention(member)}, you leveled up to level **${ddUser.level}**!`
    )

  const message = mentionWithNoPingMessage(member)
  await channel.send({
    content: message,
    embeds: [embed]
  })
}

export const tierOf = (level: number) =>
  level <= 0 ? 0 : 1 + Math.floor(level / 10)
