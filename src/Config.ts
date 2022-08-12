import {mention} from './util/users.js'
import {Config} from './config.type.js'
import {ButtonBuilder, ButtonStyle, EmbedBuilder} from 'discord.js'


// Config file for the DevDen Testing server
export const config: Config = {
	channels: {
		welcome: '932633680634081301',
		botCommands: '906954540039938048',
		hotTake: '904478147351806015',
		showcase: '952536628533030942',
		auditLog: '994623474557538415'
	},
	roles: {
		tiers: [
			'904478147351806012', //@everyone (tier 0)
			'932637161528909865', // tier 1
			'932637187030257694', // tier 2
		],
		admin: '932644914066501652',
		staff: '932644914066501652',
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
		threshold: 15
	},
	branding: {
		color: '#ffffff',
		font: 'CascadiaCode.ttf',
		welcomeMessage: member =>
			`Welcome ${mention(member)} to the Developer Den test server!\nCurrent Member Count: ${member.guild.memberCount}`
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
			[{
				type: 'faq',
				faqId: 'role-info',
				button: new ButtonBuilder()
					.setLabel('What do the different roles mean?')
					.setStyle(ButtonStyle.Success)
					.setEmoji('🎖')
			}],

		]
	}
}
