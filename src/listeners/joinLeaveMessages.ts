import {Listener} from './listener.js'
import {logger} from '../logging.js'
import {TextChannel} from 'discord.js'
import {createStandardEmbed} from '../util/embeds.js'
import {mention, pseudoMention} from '../util/users.js'
import {config} from '../Config.js'
import {branding} from '../util/branding.js'

/**
 * @deprecated
 */
export const joinLeaveListener: Listener = (client) => {
	client.on('guildMemberAdd', async member => {
		const channel = await client.channels.fetch(config.channels.welcome) as TextChannel
		if (!channel) {
			logger.error('Could not find welcome channel')
			return
		}
		await new Promise(r => setTimeout(r, 1000))
		await client.users.fetch(member.id)
		await channel.send({
			embeds: [
				{
					...createStandardEmbed(member),
					title: 'members++',
					description: branding.welcomeMessage(member),
					color: '#77dd77',
					thumbnail: {
						url: member.user.avatarURL() ?? 'https://cdn.discordapp.com/embed/avatars/0.png'
					},
					author: {
						name: pseudoMention(member.user)
					}
				}
			]
		})
	})
	client.on('guildMemberRemove', async member => {
		const channel = await client.channels.fetch(config.channels.welcome) as TextChannel
		if (!channel) {
			logger.error('Could not find welcome channel')
			return
		}
		await new Promise(r => setTimeout(r, 1000))
		await channel.send({
			embeds: [
				{
					...createStandardEmbed(member),
					title: 'members--',
					description: `${mention(member)} has left! :(\nCurrent Member Count: ${member.guild.memberCount}`,
					color: '#aa4344',
					thumbnail: {
						url: member.user.avatarURL() ?? 'https://cdn.discordapp.com/embed/avatars/0.png'
					},
					author: {
						name: pseudoMention(member.user)
					}
				}
			]
		})
	})
}
