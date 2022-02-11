import {SlashCommandBuilder} from '@discordjs/builders'
import {CommandInteraction} from 'discord.js'
import {Command} from './Commands.js'
import {config} from '../Config.js'

export class PasteCommand implements Command {
	info = new SlashCommandBuilder()
		.setName('paste')
		.setDescription('Show the paste link')

	async execute(interaction: CommandInteraction) {
		await interaction.reply(config.pastebin.url)
	}
}