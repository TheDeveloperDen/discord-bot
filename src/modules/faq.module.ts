import Module from './module'
import {FAQ} from '../store/models/FAQ'
import {GuildMember, MessageEmbedOptions, User} from 'discord.js'
import {createStandardEmbed, standardFooter} from '../util/embeds'
import {pseudoMention} from '../util/users'

const createFAQEmbed = (faq: FAQ, requester?: User, user?: GuildMember) => ({
	...createStandardEmbed(user),
	title: faq.title,
	description: faq.content,
	footer: {
		...standardFooter(),
		text: requester ? `Requested by ${pseudoMention(requester)} | ${faq.name}` : faq.name
	}
})

export const FaqModule: Module = {
	name: 'faq',
	listeners: [{
		async messageCreate(_, message) {
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

			const embed: MessageEmbedOptions = createFAQEmbed(faq, message.author, message.member ?? undefined)
			await message.reply({embeds: [embed]})
		}
	}]
}

export default FaqModule
