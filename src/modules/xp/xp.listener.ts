import { EventListener } from '../module.js'
import { Channel } from 'discord.js'
import { config } from '../../Config.js'
import { giveXp, shouldCountForStats, xpForMessage } from './xpForMessage.util.js'
import { modifyRoles } from '../../util/roles.js'
import { awaitTimeout } from '../../util/timeouts.js'
import { logger } from '../../logging.js'

const editing = new Set<string>()

export const XpListener: EventListener = {
  async messageCreate (client, msg) {
    if (msg.guild == null) return
    const author = msg.member
    if (!author) return

    const shouldCount = await shouldCountForStats(msg.author, msg, msg.channel as Channel, config)
    if (shouldCount) {
      logger.debug(`counting message ${msg.id} for XP for ${msg.author.id}`)
      const xp = xpForMessage(msg.content)
      await giveXp(author, xp)
    }
  },
  // fixme: this was copied verbatim and i have no clue what it achieves
  async guildMemberUpdate (client, member) {
    if (editing.has(member.user.id)) {
      return
    }
    editing.add(member.user.id)
    await awaitTimeout(800)
    const user = member.guild.members.resolve(member.user)
    if (user != null) {
      await modifyRoles(client, user, {
        toRemove: [],
        toAdd: []
      })
    }
    editing.delete(member.user.id)
  }
}
