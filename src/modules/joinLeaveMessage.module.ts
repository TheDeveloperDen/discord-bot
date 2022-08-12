import Module from './module.js'
import {config} from '../Config.js'
import {Client, GuildMember, PartialGuildMember, TextChannel} from 'discord.js'
import {logger} from '../logging.js'
import {createStandardEmbed} from '../util/embeds.js'
import {branding} from '../util/branding.js'
import {mention, pseudoMention} from '../util/users.js'

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
			createStandardEmbed(member)
				.setTitle(`members${isAdding ? '++' : '--'};`)
				.setDescription(isAdding ?
					branding.welcomeMessage(member) :
					// FIXME - extract this to branding?
					`${mention(member)} has left! :(\nCurrent Member Count: ${member.guild.memberCount}`)
				.setColor(isAdding ? '#77dd77' : '#aa4344')
				.setThumbnail(member.user.avatarURL() ?? 'https://cdn.discordapp.com/embed/avatars/0.png')
				.setAuthor({
					name: pseudoMention(member.user)
				})
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
