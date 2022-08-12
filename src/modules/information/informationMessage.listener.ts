import {EventListener} from '../module.js'
import {FAQ} from '../../store/models/FAQ.js'
import {createFaqEmbed} from '../faq/faq.util.js'

export const InformationButtonListener: EventListener = {
	async interactionCreate(_, interaction) {
		if (!interaction.isButton()) {
			return
		}
		const id = interaction.customId
		if (id === 'learning-resources') {
			return
		}
		if (!id.startsWith('faq-')) {
			return
		}
		const faqId = id.substring(4)

		const faq = await FAQ.findOne({
			where: {
				name: faqId
			}
		})

		if (!faq) {
			return
		}
		const embed = createFaqEmbed(faq, interaction.user)
		await interaction.reply({
			ephemeral: true,
			embeds: [embed]
		})
	}
}