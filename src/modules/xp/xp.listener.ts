import {EventListener} from '../module.js'
import {Channel} from 'discord.js'
import {shouldCountForStats} from '../../xp/levelling.js'
import {config} from '../../Config.js'
import {xpForMessage} from './xpForMessage.util.js'
import {getUserById} from '../../store/models/DDUser.js'
import {logger} from '../../logging.js'
import {levelUp} from './xpRoles.util.js'
import {modifyRoles} from '../../util/roles.js'

const editing = new Set<string>()

export const XpListener: EventListener = {
	async messageCreate(client, msg) {
		if (msg.guild == null) {
			return
		}

		if (await shouldCountForStats(msg.author, msg, msg.channel as Channel, config)) {
			const xp = xpForMessage(msg.content)
			const user = await getUserById(BigInt(msg.author.id))
			if (!user) {
				logger.error(`Could not find or create user with id ${msg.author.id}`)
				return
			}
			user.xp += xp
			await levelUp(client, await msg.guild.members.fetch(msg.author), user)
			await user.save()
			logger.info(`Gave ${xp} XP to user ${user.id} for message ${msg.id}`)
		}
	},
	// fixme: this was copied verbatim and i have no clue what it achieves
	guildMemberUpdate(client, member) {
		if (editing.has(member.user.id)) {
			return
		}
		editing.add(member.user.id)
		setTimeout(async () => {
			const user = member.guild.members.resolve(member.user)
			if (user) {
				await modifyRoles(client, user, {toRemove: [], toAdd: []})
			}
			editing.delete(member.user.id)
		}, 800)
	}
}
