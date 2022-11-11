import {ApplicationCommandOptionType, CommandInteraction, range} from 'discord.js'
import {Command} from 'djs-slash-helper'
import {ApplicationCommandType} from 'discord-api-types/v10'
import generateHotTake from './hotTakes.util.js'
import {upload} from "../pastify/pastify.js";

export const ManyHotTakesCommand: Command<ApplicationCommandType.ChatInput> = {
	name: 'manyhottakes',
	description: 'Summon MANY hot takes from the database.',
	type: ApplicationCommandType.ChatInput,
	options: [{
		type: ApplicationCommandOptionType.Integer,
		name: 'count',
		description: 'The number of hot takes to summon.',
		required: true
	}],

	handle: async (interaction: CommandInteraction) => {
		const count = interaction.options.get('count', true).value as number
		const guild = interaction.guild
		if (!guild) {
			await interaction.reply('Not in a guild')
			return
		}
		await interaction.deferReply()
		const takes = await Promise.all(range(0, count)
			.map(async () => await generateHotTake(guild)))
			.then(x => x.join('\n'))


		const pastebinURL = await upload({text: takes})
		console.log(pastebinURL);
		await interaction.followUp({content: pastebinURL})


	}
}

export default ManyHotTakesCommand
