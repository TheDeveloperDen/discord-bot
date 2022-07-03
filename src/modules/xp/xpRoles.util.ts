import {Client, GuildMember, MessageEmbedOptions, TextChannel} from 'discord.js'
import {DDUser} from '../../store/models/DDUser.js'
import {modifyRoles} from '../../util/roles.js'
import {config} from '../../Config.js'
import {createStandardEmbed} from '../../util/embeds.js'
import {mention, mentionWithNoPingMessage, pseudoMention} from '../../util/users.js'
import {tierRoleId, xpForLevel} from './xpForMessage.util.js'

export async function levelUp(client: Client, user: GuildMember, ddUser: DDUser) {
	let level = ddUser.level
	while (xpForLevel(level) <= ddUser.xp) {
		level++
	}
	if (level == ddUser.level) {
		return
	}
	ddUser.level = level
	await applyTierRoles(client, user, ddUser)
	await sendLevelUpMessage(client, user, ddUser)
}


async function applyTierRoles(client: Client, user: GuildMember, ddUser: DDUser) {
	const tier = tierRoleId(ddUser.level)
	await modifyRoles(client, user, {
		toAdd: [tier],
		toRemove: config.roles.tiers.filter(it => it != tier)
	})
}

async function sendLevelUpMessage(client: Client, member: GuildMember, ddUser: DDUser) {
	const user = member.user
	const channel = await client.channels.fetch(config.channels.botCommands) as TextChannel
	if (!channel) {
		console.error(`Could not find level up channel with id ${config.channels.botCommands}`)
		return
	}
	const embed = {
		...createStandardEmbed(member),
		title: '⚡ Level Up!',
		author: {
			name: pseudoMention(user),
			iconURL: user.avatarURL()
		},
		fields: [
			{
				name: '📈 XP',
				value: `${ddUser.xp}/${xpForLevel(ddUser.level + 1)}`
			}],
		description: `${mention(member)}, you leveled up to level **${ddUser.level}**!`
	} as MessageEmbedOptions
	const message = mentionWithNoPingMessage(member)
	await channel.send({content: message, embeds: [embed]})
}
