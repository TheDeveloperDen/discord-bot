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
        auditLog: '1004782799955435540'
    },
    commands: {
        daily: '1059214166075912225'
    },
    roles: {
        tiers: [
            '821743100203368458', // @everyone (tier 0)
            '823167811555033150', // tier 1
            '837653180774875178', // 2
            '837661828405395476', // 3
            '837662055921221712', // 4
            '837662277577998356', // 5
            '837662496432193640', // 6
            '837662699235311616', // 7
            '837662908703703070', // 8
            '837663085657194546', // 9
            '837663288064999424', // 10
            '1126116421206818916' // very high
        ],
        admin: '821814446749646853',
        staff: '857288092741009478',
        notable: '821815023223308300',
        separators: {
            general: '874786063493787658',
            tags: '874783773605130280',
            langs: '874783339981189240'
        },
        noPing: '848197427617595393',
        bumpNotifications: '1300915104568705107'
    },
    clientId: '904478222455029821',
    guildId: '821743100203368458',
    poll: {
        emojiId: '1029839969658880041',
        yesEmojiId: '997496973093502986',
        noEmojiId: '1012427085798723666'
    },
    pastebin: {
        url: 'https://paste.developerden.org',
        threshold: 20
    },
    branding: {
        color: '#C6BFF7',
        font: 'CascadiaCode.ttf',
        welcomeMessage: (member) =>
            `Welcome ${
                mention(
                    member
                )
            } to the Developer Den!\nCurrent Member Count: ${member.guild.memberCount}`,
        goodbyeMessage: (member) =>
            `${
                mention(
                    member
                )
            } has left! :(\nCurrent Member Count: ${member.guild.memberCount}`
    },

    informationMessage: {
        embed: new EmbedBuilder()
            .setImage('https://static.developerden.org/banner.png')
            .setTitle('⭐ About the Server ⭐')
            .setDescription(`
Welcome to the **Developer Den**!
We're a community of programmers who love to share knowledge and ideas.

**Need help?**
Make a post in one of the support forums at <#1019691495051247707>! For coding help, you likely want <#1019645415685111848>
 
**Want to show off things you've made?**
Post them in <#847936633964724254>!

**Just want to talk?**
Say hello in <#821743100657270876> or <#1069687712333971527>!


To invite other people to this server, you can use either of these links:
https://developerden.org/discord
https://discord.gg/devden`),

        buttonRows: [
            [
                new ButtonBuilder().setLabel('Permanent Invite Link')
                    .setURL('https://developerden.org/discord')
                    .setEmoji({
                        id: '1007753088003747910'
                    })
                    .setStyle(ButtonStyle.Link),
                new ButtonBuilder().setLabel('Our GitHub Organization')
                    .setURL('https://github.com/TheDeveloperDen')
                    .setEmoji({
                        id: '1007741713026134107'
                    })
                    .setStyle(ButtonStyle.Link),
                new ButtonBuilder().setLabel('Our Website')
                    .setURL('https://developerden.org')
                    .setEmoji('🌐')
                    .setStyle(ButtonStyle.Link)
            ],
            [
                {
                    faqId: 'codeblocks',
                    type: 'faq',
                    button: new ButtonBuilder().setLabel('How to share code')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📝')
                },
                {
                    faqId: 'ask',
                    type: 'faq',
                    button: new ButtonBuilder().setLabel('How to ask for help')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('❓')
                }
            ],
            [
                {
                    type: 'learning',
                    button: new ButtonBuilder().setLabel('Learn a new Language')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('📚')
                }
            ],
            [
                {
                    type: 'faq',
                    faqId: 'role-info',
                    button: new ButtonBuilder().setLabel('Our Server Roles')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('🎖')
                },
                {
                    type: 'faq',
                    faqId: 'xp-guide',
                    button: new ButtonBuilder().setLabel('How XP works')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('⭐')
                }
            ]
        ]
    }
}
