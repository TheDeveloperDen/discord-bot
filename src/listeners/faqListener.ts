import {Listener} from './listener.js'
import {MarkedClient} from '../MarkedClient.js'
import {FAQ} from '../store/models/FAQ.js'
import {MessageEmbedOptions} from 'discord.js'
import {createFaqEmbed} from '../modules/faq/faq.util.js'

/**
 * @deprecated
 */
export const faqListener: Listener = (client: MarkedClient) => {
	client.on('messageCreate', async message => {
		if (!message.content.startsWith('?')) return
		const arg = message.content.split(/ /)[0].substring(1)
		if (!arg) return
		const faq = await FAQ.findOne({
			where: {name: arg}
		})
		if (!faq) {
			const reply = await message.reply(`Could not find FAQ \`${arg}\``)
			setTimeout(() => reply.delete(), 5000)
			return
		}

		const embed: MessageEmbedOptions = createFaqEmbed(faq, message.author, message.member ?? undefined)
		await message.reply({embeds: [embed]})
	})
}

