import {Guild, GuildMember, PartialGuildMember} from 'discord.js'
import {config} from '../Config.js'

export type BrandingConfig = {
	name?: string,
	iconUrl?: string,
	welcomeMessage: (member: GuildMember | PartialGuildMember) => string
	fonts: { cascadia: string, montserratBold: string, montserratSemiBold: string },
	color: string
}

export let branding: Required<BrandingConfig> = {
	...config.branding,
	name: '',
	iconUrl: ''
}

export function setupBranding(guild: Guild) {
	branding = {
		...{
			name: guild.name,
			iconUrl: guild.iconURL() || 'https://cdn.discordapp.com/embed/avatars/0.png'
		},
		...config.branding
	}
}
