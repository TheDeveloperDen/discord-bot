import Module from './module.js'
import { config } from '../Config.js'
import { TextChannel } from 'discord.js'
import { actualMention } from '../util/users.js'

const ImageForwarderModule: Module = {
  name: 'imageForwarder',
  listeners: [
    {
      async messageCreate (client, message) {
        if (message.author.bot) return
        const channel = await client.channels.fetch(config.channels.auditLog)
        if (!(channel instanceof TextChannel)) return
        const attachments = message.attachments
        if (!attachments?.size) return

        return await channel.send({
          content: `Message from ${actualMention(
            message.author)} at <t:${Math.round(
            message.createdTimestamp / 1000)}>`,
          allowedMentions: { users: [] },
          files: attachments.map(v => v)
        })
      }
    }]
}

export default ImageForwarderModule
