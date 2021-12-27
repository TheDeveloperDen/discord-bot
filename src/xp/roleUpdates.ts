import {EventHandler} from '../EventHandler.js'
import {modifyRoles} from '../util/roles.js'

const editing = new Set<string>()

export const roleChangeListener: EventHandler = (client) =>
// save the user's message when they send a message
	client.on('guildMemberUpdate', (event) => {
		if (editing.has(event.user.id)) {
			return
		}
		editing.add(event.user.id)
		setTimeout(async () => {
			const user = event.guild.members.resolve(event.user)
			if (user) {
				await modifyRoles(client, user, {toRemove: [], toAdd: []})
			}
			editing.delete(event.user.id)
		}, 800)
	})
