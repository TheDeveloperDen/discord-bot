import {SlashCommandBuilder} from '@discordjs/builders'
import {CommandInteraction} from 'discord.js'
import {Command} from './Commands.js'
import {generateHotTake} from '../hotTakeSender.js'


export const HotTakeCommand: Command = {
	info: new SlashCommandBuilder()
		.setName('hottake')
		.setDefaultPermission(false)
		.setDescription('Summon a hot take from the database.'),

	async execute(interaction: CommandInteraction) {
		const hotTake = await generateHotTake(interaction.guild ?? undefined)
		await interaction.reply({content: hotTake, allowedMentions: {users: []}})
	}
}