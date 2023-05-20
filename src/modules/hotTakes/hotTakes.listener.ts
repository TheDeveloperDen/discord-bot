import { Client, TextChannel } from 'discord.js'
import { config } from '../../Config.js'
import { EventListener } from '../module.js'
import generateHotTake from './hotTakes.util.js'
import { awaitTimeout } from '../../util/timeouts.js'
import { logger } from '../../logging.js'

async function sendHotTake (client: Client) {
  logger.debug('Sending hot take maybe')
  const channel = await client.channels.fetch(config.channels.hotTake) as TextChannel
  const lastMessage = (await channel.messages.fetch({ limit: 1 }))
    .first()

  if (!lastMessage) { return }

  logger.debug(`Last message: ${lastMessage.id}`)
  const lastMessageSentAt = lastMessage.createdAt

  // time since last message in seconds
  const timeSinceLastMessage = (Date.now() - lastMessageSentAt.getTime()) / 1000
  if (lastMessage.author.bot || timeSinceLastMessage < 60 * 60 * 2) {
    return
  }
  logger.debug(`Time since last message: ${timeSinceLastMessage}, met threshold`)
  const hotTake = await generateHotTake(channel.guild)
  await channel.send({
    content: hotTake,
    allowedMentions: { users: [] }
  })
}

async function hotTakeLoop (client: Client) {
  if (!client.isReady()) return
  await sendHotTake(client)
  await awaitTimeout(60 * 1000)
  await hotTakeLoop(client)
}

export const HotTakeListener: EventListener = {
  ready: hotTakeLoop
}

export default HotTakeListener
