import {Listener} from './listener.js'
import {MarkedClient} from '../MarkedClient.js'
import {FAQ} from '../store/models/FAQ.js'
import {createStandardEmbed, standardFooter} from '../util/embeds.js'
import {GuildMember, MessageEmbedOptions, User} from 'discord.js'
import {pseudoMention} from '../util/users.js'

export const faqListener: Listener = (client: MarkedClient) => {
	client.on('messageCreate', async message => {
		if (!message.content.startsWith('?')) return
		const arg = message.content.split(/ /)[0].substring(1)
		const faq = await FAQ.findOne({
			where: {name: arg}
		})
		if (!faq) {
			const reply = await message.reply(`Could not find FAQ \`${arg}\``)
			setTimeout(() => reply.delete(), 5000)
			return
		}

		const embed: MessageEmbedOptions = createFAQEmbed(faq, message.author, message.member ?? undefined)
		await message.reply({embeds: [embed]})
	})
}

export const createFAQEmbed = (faq: FAQ, requester?: User, user?: GuildMember) => {
	return {
		...createStandardEmbed(user),
		title: faq.title,
		description: faq.content,
		footer: {
			...standardFooter(),
			text: requester ? `Requested by ${pseudoMention(requester)} | ${faq.name}` : faq.name
		}
	}
}