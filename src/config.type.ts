import {Snowflake} from 'discord.js'
import {BrandingConfig} from './util/branding.js'
import {InformationMessage} from './modules/information/information.js'

export type Config = {
	guildId: string,
	clientId: string,
	pastebin: { url: string, threshold: number },
	channels: { welcome: string, botCommands: string, hotTake: string, showcase: string, auditLog: string },
	roles: {
		tiers: Snowflake[],
		admin: Snowflake,
		notable?: Snowflake,
		staff: Snowflake,
		bumpNotifications: Snowflake,
		separators: { general: Snowflake, tags: Snowflake, langs: Snowflake },
		noPing: Snowflake,
		usersAllowedToSet: Snowflake[]
	},
	branding: BrandingConfig,
	informationMessage?: InformationMessage
}
