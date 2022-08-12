import {CommandInteraction, MessageEmbedOptions, MessageOptions} from 'discord.js'
import {Command} from 'djs-slash-helper'
import {ApplicationCommandType} from 'discord-api-types/v10'
import createEmbedModal from './embedContent.modal.js'
import {createStandardEmbed} from '../../util/embeds.js'


export const EmbedMessageCommand: Command<ApplicationCommandType.ChatInput> = {
	name: 'embed',
	type: ApplicationCommandType.ChatInput,
	description: 'Create an embed message in the current channel',
	options: [],


	async handle(interaction: CommandInteraction) {
		const channel = interaction.channel
		if (!channel) {
			await interaction.reply('Channel is nul')
			return
		}
		const modal = createEmbedModal()
		await interaction.showModal(modal)
		const response = await interaction.awaitModalSubmit({time: 2 ** 31 - 1})

		await response.reply({ephemeral: true, content: 'Ok'})
		const content = response.fields.getField('contentField').value
		const messageContent = JSON.parse(content) as MessageOptions
		const editedContent = {
			...messageContent,
			embeds: messageContent.embeds?.map(embed => {
				return {
					...createStandardEmbed(),
					...embed
				} as MessageEmbedOptions
			})
		}
		channel.send(editedContent)

	}

}

