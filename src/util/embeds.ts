import {GuildMember, MessageEmbedOptions, PartialGuildMember} from 'discord.js'
import {branding} from './branding.js'
import {EmbedFooterOptions} from '@discordjs/builders'

export const createStandardEmbed = (user?: GuildMember | PartialGuildMember) => <MessageEmbedOptions>{
	color: user?.roles?.color?.hexColor ?? branding.color,
	footer: standardFooter(),
	timestamp: new Date(),
}
export const standardFooter = () => <EmbedFooterOptions>{
	text: branding.name,
	icon_url: branding.iconUrl
}

