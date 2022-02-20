import {Guild, GuildMember} from 'discord.js'
import {config} from '../Config.js'

export type BrandingConfig = {
	name?: string,
	iconUrl?: string,
	welcomeMessage: (member: GuildMember) => string
	font: string,
	color: string
}

export let branding: Required<BrandingConfig> = {
	...config.branding,
	name: '',
	iconUrl: ''
}

export const setupBranding = (guild: Guild) => {
	branding = {
		...{
			name: guild.name,
			iconUrl: guild.iconURL() || 'https://cdn.discordapp.com/embed/avatars/0.png'
		},
		...config.branding
	}
}