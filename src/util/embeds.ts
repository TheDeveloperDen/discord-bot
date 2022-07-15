import {ColorResolvable, GuildMember, MessageEmbedOptions, PartialGuildMember} from 'discord.js'
import {branding} from './branding.js'
import {EmbedFooterOptions} from '@discordjs/builders'

export const createStandardEmbed: (user?: GuildMember | PartialGuildMember) => MessageEmbedOptions = (user) => ({
	color: user?.roles?.color?.hexColor ?? branding.color as ColorResolvable,
	footer: standardFooter(),
	timestamp: new Date(),
})

export const standardFooter: () => EmbedFooterOptions = () =>
	({
		text: branding.name,
		icon_url: branding.iconUrl
	})
