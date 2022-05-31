import {MarkedClient} from '../MarkedClient.js'
import {getUserById} from '../store/models/DDUser.js'
import fuzzysort from 'fuzzysort'
import {Listener} from './listener.js'
import {createFAQEmbed} from './faqListener.js'
import {FAQ} from '../store/models/FAQ.js'
import {logger} from '../logging.js'
import {tierOf} from '../xp/levelling.js'

const targets = ['help', 'question', 'have', 'ask', 'problem', 'need', 'i', 'issue']
	.map(x => x.toLowerCase())
	.map(x => fuzzysort.prepare(x))

export const askToAskListener: Listener = (client: MarkedClient) => {
	client.on('messageCreate', async message => {
		if (message.author.bot) return
		const ddUser = await getUserById(BigInt(message.author.id))
		if (tierOf(ddUser.level) >= 2) return // Hopefully they will have learned by now
		const c = message.content.toLowerCase().trim().replace(/[^a-z\d ]/g, '')
		if (!c) return
		const words = c.split(/ /)
		const results = words.flatMap(word => fuzzysort.go(word, targets, {
			all: true,
		}))
		if (results.length === 0) return
		const score = results.map(i => i.score).reduce((a, b) => a + b, 0)
		if (score > -1000 * targets.length) {
			const faq = await FAQ.findOne({where: {name: 'ask'}})
			if (!faq) {
				logger.error('Could not find FAQ for ask')
				return
			}
			await message.reply({embeds: [createFAQEmbed(faq, undefined)]})
		}
	})
}