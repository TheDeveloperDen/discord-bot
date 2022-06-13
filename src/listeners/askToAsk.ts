import {MarkedClient} from '../MarkedClient.js'
import {getUserById} from '../store/models/DDUser.js'
import stringSimilarity from 'string-similarity'
import {Listener} from './listener.js'
import {createFAQEmbed} from './faqListener.js'
import {FAQ} from '../store/models/FAQ.js'
import {logger} from '../logging.js'
import {tierOf} from '../xp/levelling.js'

const targets = ['i need help', 'i have a problem', 'help me please', 'can anyone help me', 'someone help me', 'i have a question']
	.map(x => x.toLowerCase())

export const askToAskListener: Listener = (client: MarkedClient) => {
	client.on('messageCreate', async message => {
		if (message.author.bot) return
		const ddUser = await getUserById(BigInt(message.author.id))
		if (tierOf(ddUser.level) >= 2) return // Hopefully they will have learned by now
		const c = message.content.toLowerCase().trim().replace(/[^a-z\d ]/g, '')
		if (!c) return
		const words = c.split(/ /).filter(s => s.length > 1).join(' ')
		const results = stringSimilarity.findBestMatch(words, targets)
		logger.info(`Ask to ask score for ${c} was ${results.bestMatch.rating}`)
		if (results.bestMatch.rating > 0.5) {
			const faq = await FAQ.findOne({where: {name: 'ask'}})
			if (!faq) {
				logger.error('Could not find FAQ for ask')
				return
			}
			await message.reply({embeds: [createFAQEmbed(faq, undefined)]})
		}
	})
}