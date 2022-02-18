import {mention} from './util/users.js'
import {Config} from './config.type'

// Config file for the Developer Den server (.gg/devden)
export const config: Config = {
	channels: {
		welcome: '821743171942744114',
		botCommands: '821820015917006868',
		hotTake: '821743100657270876'
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
		admin: '821814446749646853',
		separators: {
			general: '874786063493787658',
			tags: '874783773605130280',
			langs: '874783339981189240'
		},
		bumpNotifications: '838500233268691005',
		noPing: '848197427617595393',
		usersAllowedToSet: []
	},
	clientId: '904478222455029821',
	guildId: '821743100203368458',
	pastebin: {
		url: 'https://paste.developerden.net',
		threshold: 15
	},
	branding: {
		color: '#C6BFF7',
		font: 'font.otf',
		welcomeMessage: member =>
			`Welcome ${mention(member)} to the Developer Den!\nCurrent Member Count: ${member.guild.memberCount}`
	}
}
