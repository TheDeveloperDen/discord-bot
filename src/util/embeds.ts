import {config} from '../Config.js'
import {GuildMember, MessageEmbedOptions} from 'discord.js'

export const createStandardEmbed = (user?: GuildMember) => <MessageEmbedOptions>{
	color: user?.roles?.color?.hexColor ?? config.color,
	footer: {text: 'Developer Den', icon_url: 'https://developerden.net/static/logo.png'},
	timestamp: new Date(),
}

