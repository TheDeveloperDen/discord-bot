import {Client, GuildMember, MessageEmbedOptions, TextChannel} from 'discord.js'
import {shouldCountForStats, tierRoleId} from './levelling.js'
import {config} from '../Config.js'
import {xpForLevel, xpForMessage} from './experienceCalculations.js'
import {DDUser, getUserById} from '../store/models/DDUser.js'
import {Listener} from '../listeners/listener.js'
import {createStandardEmbed} from '../util/embeds.js'
import {mention, mentionWithNoPingMessage, pseudoMention} from '../util/users.js'
import {modifyRoles} from '../util/roles.js'
import {logger} from '../logging.js'

export const xpHandler: Listener = (client) => {
	client.on('messageCreate', async msg => {
		if (!(msg.channel instanceof TextChannel)) {
			return
		}
		if (msg.guild == null) {
			return
		}
		if (await shouldCountForStats(msg.author, msg, msg.channel, config)) {
			const xp = xpForMessage(msg.content)
			const author = msg.member ?? await msg.guild.members.fetch(msg.author.id)
			if (!author) {
				return
			}

			await giveXP(author, xp)
		}
	})
}

/**
 * Gives XP to a member
 * @param user the member to give XP to
 * @param xp the amount of XP to give
 * @returns How much XP was given and the multiplier used. This may be affected by perks such as boosting. If something went wrong, -1 will be returned.
 */
export const giveXP = async (user: GuildMember, xp: number): Promise<XPResult> => {
	const client = user.client
	let multiplier = 1
	if (user.premiumSince != null) {
		multiplier *= 2 // double xp for boosters
	}
	const ddUser = await getUserById(BigInt(user.id))
	if (!ddUser) {
		logger.error(`Could not find or create user with id ${user.id}`)
		return {xpGiven: -1}
	}
	ddUser.xp += xp * multiplier
	await levelUp(client, user, ddUser)
	await ddUser.save()
	logger.info(`Gave ${xp} XP to user ${user.id}`)
	return {xpGiven: xp * multiplier, multiplier: multiplier == 1 ? undefined : multiplier}
}

/**
 * Result of giving a member XP
 * @param xpGiven The amount of XP given
 * @param multiplier The multiplier used. If undefined, no multiplier was used, i.e. the multiplier was 1
 */
export type XPResult = {
	xpGiven: number,
	multiplier?: number
}

const levelUp = async (client: Client, user: GuildMember, ddUser: DDUser) => {
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

const applyTierRoles = async (client: Client, user: GuildMember, ddUser: DDUser) => {
	const tier = tierRoleId(ddUser.level)
	await modifyRoles(client, user, {
		toAdd: [tier],
		toRemove: config.roles.tiers.filter(it => it != tier)
	})
}

const sendLevelUpMessage = async (client: Client, member: GuildMember, ddUser: DDUser) => {
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