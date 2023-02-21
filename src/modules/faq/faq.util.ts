import {FAQ} from '../../store/models/FAQ.js'
import {GuildMember, User} from 'discord.js'
import {createStandardEmbed, standardFooter} from '../../util/embeds.js'
import {pseudoMention} from '../../util/users.js'
import {APIEmbed} from "discord-api-types/v10";


export function createFaqEmbed(faq: FAQ, requester?: User, user?: GuildMember): APIEmbed {
	return {
		...createStandardEmbed(user),
		title: faq.title,
		description: faq.content,
		footer: {
			...standardFooter,
			text: requester ? `Requested by ${pseudoMention(requester)} | ${faq.name}` : faq.name
		}
	};
}
