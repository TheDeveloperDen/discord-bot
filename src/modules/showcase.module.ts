import Module from './module.js'
import { config } from '../Config.js'
import { Collection, MessageReaction, Snowflake } from 'discord.js'

export const ShowcaseModule: Module = {
  name: 'showcase',
  listeners: [
    {
      async messageCreate (_, message) {
        if (message.channel.id !== config.channels.showcase) return
        if (message.author.bot || message.system) return
        await message.react('👍')
        await message.react('👎')
      },

      async messageReactionAdd (_, reaction, user) {
        if (reaction.message.channel.id !== config.channels.showcase) return
        if (user.bot || user.system) return
        if (user.partial) {
          user = await user.fetch()
        }
        if (reaction.partial) {
          reaction = await reaction.fetch()
        }
        if (user.id === reaction.message.author?.id) {
          await reaction.users.remove(user)
          return
        }

        const userHasReacted = async (
          emoji: string
        ): Promise<Collection<Snowflake | string, MessageReaction>> => {
          const rs = await reaction.message.awaitReactions(
            { filter: (r) => r.emoji.name === emoji }
          )
          return rs.filter((r) => r.users.resolve(user.id) != null)
        }
        if (reaction.emoji.name === '👍' && await userHasReacted('👎')) {
          await reaction.users.remove(user)
          return
        }
        if (reaction.emoji.name === '👎' && await userHasReacted('👍')) {
          await reaction.users.remove(user)
        }
      }
    }
  ]
}
