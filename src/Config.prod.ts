import {mention} from './util/users.js'
import {Config} from './config.type.js'
import {ButtonBuilder, ButtonStyle, EmbedBuilder} from 'discord.js'

// Config file for the Developer Den server (.gg/devden)
export const config: Config = {
	channels: {
		welcome: '821743171942744114',
		botCommands: '821820015917006868',
		hotTake: '932661343520194640',
		showcase: '847936633964724254',
		auditLog: '833758624756138044'
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
		staff: '857288092741009478',
		notable: '821815023223308300',
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
	poll: {
		emojiId: '1029839987652448258',
		yesEmojiId: '1029843670205218977',
		noEmojiId: '1029843702144848002'
	},
	pastebin: {
		url: 'https://paste.developerden.net',
		threshold: 20
	},
	branding: {
		color: '#C6BFF7',
		font: 'CascadiaCode.ttf',
		welcomeMessage: member =>
			`Welcome ${mention(member)} to the Developer Den!\nCurrent Member Count: ${member.guild.memberCount}`
	},

	informationMessage: {
		embed: new EmbedBuilder()
			.setImage('https://developerden.net/static/banner.png')
			.setTitle('⭐About the Server⭐')
			.setDescription(`
			Welcome to the **Developer Den**!
			We're a community of programmers who love to share knowledge and ideas.
			
			**Need help?**
			Find the channel for the language you're using and ask away! Can't find the right channel? Use <#826146919536656495>
			
			**Want to show off things you've made?**
			Post them in <#847936633964724254>!
			
			**Just want to talk?**
		    Say hello in <#821743100657270876>!
			
			
			To invite other people to this server, you can use either of these links:
			https://developerden.net/discord
			https://discord.gg/devden`),

		buttonRows: [
			[
				new ButtonBuilder()
					.setLabel('Permanent Invite Link')
					.setURL('https://developerden.net/discord')
					.setEmoji({
						id: '1007753088003747910'
					})
					.setStyle(ButtonStyle.Link)
				,
				new ButtonBuilder()
					.setLabel('Our GitHub Organization')
					.setURL('https://github.com/TheDeveloperDen')
					.setEmoji({
						id: '1007741713026134107'
					})
					.setStyle(ButtonStyle.Link),
				new ButtonBuilder()
					.setLabel('Our Website')
					.setURL('https://developerden.net')
					.setEmoji('🌐')
					.setStyle(ButtonStyle.Link)
			],
			[
				{
					faqId: 'codeblocks',
					type: 'faq',
					button: new ButtonBuilder()
						.setLabel('How to share code')
						.setStyle(ButtonStyle.Primary)
						.setEmoji('📝')
				},
				{
					faqId: 'ask',
					type: 'faq',
					button: new ButtonBuilder()
						.setLabel('How to ask for help')
						.setStyle(ButtonStyle.Primary)
						.setEmoji('❓')
				},
			],
			[{
				type: 'learning',
				button: new ButtonBuilder()
					.setLabel('Learn a new Language')
					.setStyle(ButtonStyle.Success)
					.setEmoji('📚')
			}],
			[
				{
					type: 'faq',
					faqId: 'role-info',
					button: new ButtonBuilder()
						.setLabel('Our Server Roles')
						.setStyle(ButtonStyle.Success)
						.setEmoji('🎖')
				},
				{
					type: 'faq',
					faqId: 'xp-guide',
					button: new ButtonBuilder()
						.setLabel('How XP works')
						.setStyle(ButtonStyle.Success)
						.setEmoji('⭐')
				},
			],
		]
	}
}
