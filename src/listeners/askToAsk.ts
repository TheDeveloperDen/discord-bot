import {MarkedClient} from '../MarkedClient.js'
import {getUserById} from '../store/models/DDUser.js'
import fuzzysort from 'fuzzysort'
import {Listener} from './listener.js'
import {tierOf} from '../xp/levelling.js'

const targets = ['I have a question', 'I need help', 'Can I ask a question?', 'Can I ask questions here?', 'I have a problem']
	.map(x => x.toLowerCase())
	.map(x => fuzzysort.prepare(x))

export const askToAskListener: Listener = (client: MarkedClient) => {
	client.on('messageCreate', async message => {
		if (message.author.bot) return
		const ddUser = await getUserById(BigInt(message.author.id))
		if (tierOf(ddUser.level) >= 2) return // Hopefully they will have learned by now
		const c = message.content.toLowerCase()
		if (!c) return
		const results = fuzzysort.go(c, targets, {
			all: true,
			threshold: -200
		})
		if (results.length > 0) {
			await message.reply('Ask away! Please give as much information as possible to help us help you! (<https://dontasktoask.com/>)')
		}
	})
}