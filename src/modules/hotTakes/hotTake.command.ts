import {CommandInteraction} from 'discord.js'
import {Command} from 'djs-slash-helper'
import {ApplicationCommandType} from 'discord-api-types/v10'
import generateHotTake from './hotTakes.util.js'

export const HotTakeCommand: Command<ApplicationCommandType.ChatInput> = {
	name: 'hottake',
	description: 'Summon a hot take from the database.',
	type: ApplicationCommandType.ChatInput,
	options: [],

	handle: async (interaction: CommandInteraction) => interaction.reply(
		interaction.guild ? {
			content: await generateHotTake(interaction.guild),
			allowedMentions: {users: []}
		} : 'Not in a guild')
}

export default HotTakeCommand
