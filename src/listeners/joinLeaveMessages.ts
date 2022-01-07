import {EventHandler} from '../EventHandler.js'
import {logger} from '../logging.js'
import {TextChannel} from "discord.js";
import {createStandardEmbed} from "../util/embeds.js";
import {mention} from "../util/users.js";

const welcomeChannelId = '821743171942744114'
export const joinLeaveListener: EventHandler = (client) => {
	client.on('guildMemberAdd', async member => {
		const channel = await client.channels.fetch(welcomeChannelId) as TextChannel
		if (!channel) {
			logger.error('Could not find welcome channel');
			return
		}
		await channel.send({
			embeds: [
				{
					...createStandardEmbed(member),
					title: 'members++',
					description: `Welcome ${mention(member)} to the Developer Den!\nCurrent Member Count: ${member.guild.memberCount}`,
					color: '#77dd77',
					thumbnail: {
						url: member.avatarURL() ?? 'https://cdn.discordapp.com/embed/avatars/0.png'
					},
					author: {
						name: member.displayName
					}
				}
			]
		})
	})
	client.on('guildMemberRemove', async member => {
		const channel = await client.channels.fetch(welcomeChannelId) as TextChannel
		if (!channel) {
			logger.error('Could not find welcome channel');
			return
		}
		await channel.send({
			embeds: [
				{
					...createStandardEmbed(member),
					title: 'members--',
					description: `${mention(member)} has left! :(\nCurrent Member Count: ${member.guild.memberCount}`,
					color: '#aa4344',
					thumbnail: {
						url: member.avatarURL() ?? 'https://cdn.discordapp.com/embed/avatars/0.png'
					},
					author: {
						name: member.displayName
					}
				}
			]
		})
	})
}