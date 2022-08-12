import {ColorResolvable, EmbedBuilder, GuildMember, PartialGuildMember} from 'discord.js'
import {branding} from './branding.js'
import {EmbedFooterOptions} from '@discordjs/builders'

export const createStandardEmbed = (user?: GuildMember | PartialGuildMember) => {
	const builder = new EmbedBuilder()
	builder.setColor(user?.roles?.color?.hexColor ?? branding.color as ColorResolvable)
	builder.setFooter(standardFooter())
	builder.setTimestamp(new Date())
	return builder
}


export const standardFooter: () => EmbedFooterOptions = () =>
	({
		text: branding.name,
		icon_url: branding.iconUrl
	})
