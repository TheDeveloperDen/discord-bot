import {BrandingConfig} from './util/branding.js'
import {Snowflake} from 'discord-api-types'

export type Config = {
	guildId: string,
	clientId: string,
	pastebin: { url: string, threshold: number },
	channels: { welcome: string, botCommands: string },
	roles: {
		tiers: Snowflake[],
		admin: Snowflake,
		bumpNotifications: Snowflake,
		separators: { general: Snowflake, tags: Snowflake, langs: Snowflake },
		noPing: Snowflake,
		usersAllowedToSet: Snowflake[]
	},
	branding: BrandingConfig
}