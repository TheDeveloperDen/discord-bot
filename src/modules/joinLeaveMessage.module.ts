import Module from './module'
import {config} from '../Config'
import {Client, GuildMember, PartialGuildMember, TextChannel} from 'discord.js'
import {logger} from '../logging'
import {createStandardEmbed} from '../util/embeds'
import {branding} from '../util/branding'
import {mention, pseudoMention} from '../util/users'

const handler = (isAdding: boolean) => async function (client: Client, member: PartialGuildMember | GuildMember) {
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
				title: `members${isAdding ? '++' : '--'};`,
				description: isAdding ?
					branding.welcomeMessage(member) :
					// FIXME - extract this to branding?
					`${mention(member)} has left! :(\nCurrent Member Count: ${member.guild.memberCount}`,
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
}

export const JoinLeaveMessageModule: Module = {
	name: 'joinLeaveMessage',
	listeners: [{
		guildMemberAdd: handler(true),
		guildMemberRemove: handler(false)
	}]
}

export default JoinLeaveMessageModule
