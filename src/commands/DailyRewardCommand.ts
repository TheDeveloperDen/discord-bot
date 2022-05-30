import {Command} from './Commands.js'
import {SlashCommandBuilder} from '@discordjs/builders'
import {CommandInteraction} from 'discord.js'

export const DailyRewardCommand : Command = {
	info: new SlashCommandBuilder()
		.setName('daily')
		.setDescription('Claim your daily reward'),
	
	async execute(interaction: CommandInteraction) {
		await interaction.reply('TODO')
	}
}