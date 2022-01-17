import {HexColorString, Snowflake} from 'discord.js'

export type Config = {
	bumpNotificationRoleId: Snowflake,
	color: HexColorString,
	guildId: string,
	clientId: string,
	pastebin: { url: string, threshold: number },
	channels: { welcome: string, botCommands: string },
	roles: {
		tiers: string[],
		bumpNotifications: string,
		separators: { general: string, tags: string, langs: string },
		noPing: string
	}
}

export const config: Config = {
	color: '#0xC6BFF7',
	channels: {
		welcome: '821743171942744114',
		botCommands: '821820015917006868',
	},
	roles: {
		tiers: [
			'821743100203368458', //@everyone (tier 0)
			'823167811555033150', // tier 1
			'837653180774875178', // 2
			'837661828405395476', // 3
			'837662055921221712', // 4
			'837662277577998356', // 5
			'837662496432193640', // 6
			'837662699235311616', // 7
			'837662908703703070', // 8
			'837663085657194546', // 9
			'837663288064999424'
		],
		separators: {
			general: '874786063493787658',
			tags: '874783773605130280',
			langs: '874783339981189240'
		},
		bumpNotifications: '838500233268691005',
		noPing: '848197427617595393'
	},
	bumpNotificationRoleId: '',
	clientId: '904478222455029821',
	guildId: '821743100203368458',
	pastebin: {
		url: 'https://paste.developerden.net',
		threshold: 10
	}
}