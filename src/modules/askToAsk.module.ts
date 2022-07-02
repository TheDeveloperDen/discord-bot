import Module from './module.js'
import {getUserById} from '../store/models/DDUser'
import {tierOf} from '../xp/levelling'
import stringSimilarity from 'string-similarity'
import {logger} from '../logging'
import {FAQ} from '../store/models/FAQ'
import {createFAQEmbed} from '../listeners/faqListener'

const targets = ['i need help', 'i have a problem', 'help me please', 'can anyone help me', 'someone help me', 'i have a question']
	.map(String.prototype.toLowerCase)

export const AskToAskModule: Module = {
	name: 'askToAsk',
	listeners: [{
		async messageCreate(_, message) {
			if (message.author.bot) return
			const ddUser = await getUserById(BigInt(message.author.id))
			if (tierOf(ddUser.level) >= 2) return // Hopefully they will have learned by now
			const c = message.content.toLowerCase().trim().replace(/[^a-z\d ]/g, '')
			if (!c) return
			const words = c.split(/ /).filter(s => s.length > 1).join(' ')
			const results = stringSimilarity.findBestMatch(words, targets)

			if (results.bestMatch.rating > 0.5) {
				const faq = await FAQ.findOne({where: {name: 'ask'}})
				if (!faq) {
					logger.error('Could not find FAQ for ask')
					return
				}
				await message.reply({embeds: [createFAQEmbed(faq, undefined)]})
			}
		}
	}]
}

export default AskToAskModule
