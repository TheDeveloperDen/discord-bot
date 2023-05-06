import { EventListener } from '../module.js'
import { Channel } from 'discord.js'
import { config } from '../../Config.js'
import {
  giveXp,
  shouldCountForStats,
  xpForMessage
} from './xpForMessage.util.js'
import { modifyRoles } from '../../util/roles.js'
import { awaitTimeout } from '../../util/timeouts'

const editing = new Set<string>()

export const XpListener: EventListener = {
  async messageCreate (client, msg) {
    if (msg.guild == null) return
    if (await shouldCountForStats(msg.author, msg, msg.channel as Channel,
      config)) {
      const xp = xpForMessage(msg.content)
      const author = msg.member ?? await msg.guild.members.fetch(msg.author.id)
      if (!author) return
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
