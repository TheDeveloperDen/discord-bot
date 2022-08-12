import {Command} from 'djs-slash-helper'
import {APIEmbed, ApplicationCommandType} from 'discord-api-types/v10'
import {config} from '../../Config.js'
import {ActionRowBuilder, ButtonBuilder} from 'discord.js'
import {createStandardEmbed} from '../../util/embeds.js'

export const InformationMessageCommand: Command<ApplicationCommandType.Message> = {
	name: 'Set Information Message',
	default_permission: false,
	type: ApplicationCommandType.Message,
	async handle(interaction) {

		if (!interaction.targetMessage.editable) {
			await interaction.reply({ephemeral: true, content: 'I can\'t edit that message.'})
			return
		}

		if (!config.informationMessage) {
			await interaction.reply({ephemeral: true, content: 'There is no information message configured.'})
			return
		}
		const informationMessage = config.informationMessage
		const embed = {
			...createStandardEmbed().data,
			...informationMessage.embed.data
		} as APIEmbed
		const faqButtons = informationMessage.buttons

		await interaction.targetMessage.edit({
			content: informationMessage.content,
			embeds: [embed],
			components: faqButtons.map(faqButton => {
				let button: ButtonBuilder
				if (faqButton instanceof ButtonBuilder) {
					button = faqButton
				} else {
					switch (faqButton.type) {
					case 'faq':
						button = faqButton.button.setCustomId(`faq-${faqButton.faqId}`)
						break
					case 'learning':
						button = faqButton.button.setCustomId('learning-resources')
						break
					}
				}
				return new ActionRowBuilder<ButtonBuilder>().addComponents(button)
			})
		})

		await interaction.reply({ephemeral: true, content: 'Information message set.'})
	}
}
