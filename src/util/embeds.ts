import {GuildMember, MessageEmbedOptions, PartialGuildMember} from 'discord.js'
import {branding} from './branding.js'

export const createStandardEmbed = (user?: GuildMember|PartialGuildMember) => <MessageEmbedOptions>{
	color: user?.roles?.color?.hexColor ?? branding.color,
	footer: {text: branding.name, icon_url: branding.iconUrl},
	timestamp: new Date(),
}

