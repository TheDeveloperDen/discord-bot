import {Command} from 'djs-slash-helper'
import {ApplicationCommandType} from 'discord-api-types/v10'
import {CommandInteraction, EmbedBuilder} from 'discord.js'
import Parser from 'rss-parser'
import TurndownService from 'turndown'


const web3RssUrl = 'https://web3isgoinggreat.com/feed.xml'

const rssParser = new Parser()

const turndownService = new TurndownService({ bulletListMarker: '-' })

export const Web3Command: Command<ApplicationCommandType.ChatInput> = {
	name: 'web3fact',
	description: 'Learn more about Web3, the future of human society',
	type: ApplicationCommandType.ChatInput,
	options: [],

	async handle(interaction: CommandInteraction) {
		const feed = await rssParser.parseURL(web3RssUrl)
		const recentEntries = feed.items.slice(0, 10)
		const entry = recentEntries.randomElement()
		const embed = new EmbedBuilder()
			.setTitle(entry.title ?? 'Missing title')
			.setAuthor({name: 'Molly White', url: 'https://mollywhite.net'})
			.setURL(entry.link ?? feed.link ?? 'http://example.com')
			.setDescription(turndownService.turndown(entry.content ?? 'Missing content'))
			.setTimestamp(new Date(entry.pubDate ?? Date().toString()))
			.setFooter({text: feed.title ?? 'Missing feed title'})
			.toJSON()
		await interaction.reply({embeds: [embed]})
	}
}

export default Web3Command