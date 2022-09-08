import {Command} from 'djs-slash-helper'
import {ApplicationCommandType} from 'discord-api-types/v10'
import {CommandInteraction, EmbedBuilder} from 'discord.js'
import Parser from 'rss-parser'
import TurndownService from 'turndown'
import fetch from 'node-fetch'


const web3RssUrl = 'https://web3isgoinggreat.com/feed.xml'

const rssParser = new Parser()

const turndownService = new TurndownService({ bulletListMarker: '-' })

const imgTag = /<img.*?\/>/g

export const Web3Command: Command<ApplicationCommandType.ChatInput> = {
	name: 'web3fact',
	description: 'Learn more about Web3, the future of human society',
	type: ApplicationCommandType.ChatInput,
	options: [],

	async handle(interaction: CommandInteraction) {
		const xml = await fetch(web3RssUrl, {compress: true})
			.then(r => r.text())
			.catch(e => console.log(e))
		if (xml == undefined) {
			await interaction.reply({content: 'Couldn\'t fetch RSS feed.'})
			return
		}
		const feed = await rssParser.parseString(xml as string)
		const recentEntries = feed.items.slice(0, 10)
		const entry = recentEntries.randomElement()
		const embed = new EmbedBuilder()
			.setTitle(entry.title ?? 'Missing title')
			.setAuthor({name: 'Molly White', url: 'https://mollywhite.net', iconURL: 'https://storage.googleapis.com/primary-web3/monkey_500.webp'})
			.setColor(0x1F193A)
			.setURL(entry.link ?? feed.link ?? 'http://example.com')
			// why do I have to regex match img tags? because turndown filters don't detect them for some reason
			.setDescription(turndownService.turndown(entry.content?.replaceAll(imgTag, '') ?? 'Missing content'))
			.setTimestamp(new Date(entry.isoDate ?? Date().toString()))
			.setFooter({text: feed.title ?? 'Missing feed title'})
			.toJSON()
		await interaction.reply({embeds: [embed]})
	}
}

export default Web3Command