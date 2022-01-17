import {mention} from './util/users.js'
import {Config} from './config.type'


// Config file for the DevDen Testing server
export const config: Config = {
	channels: {
		welcome: '932633680634081301',
		botCommands: '906954540039938048',
	},
	roles: {
		tiers: [
			'904478147351806012', //@everyone (tier 0)
			'932637161528909865', // tier 1
			'932637187030257694', // tier 2
		],
		admin: '932644914066501652',
		separators: {
			general: '932638046153744434',
			tags: '932638097311666218',
			langs: '932638149618835466'
		},
		bumpNotifications: '932637334103531521',
		noPing: '932637353263128577',
		usersAllowedToSet: []
	},
	clientId: '932387188585398353',
	guildId: '904478147351806012',
	pastebin: {
		url: 'https://paste.developerden.net',
		threshold: 10
	},
	branding: {
		color: '#ffaaff',
		font: 'font.otf',
		welcomeMessage: member => 
			`Welcome ${mention(member)} to the Developer Den test server!\nCurrent Member Count: ${member.guild.memberCount}`
	}
}