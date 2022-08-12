import {FAQ} from '../../store/models/FAQ.js'
import {
	MessageActionRow,
	MessageSelectMenu,
	MessageSelectOptionData,
	Modal,
	ModalActionRowComponent,
	TextInputComponent
} from 'discord.js'


export const createAddFAQModal = async () => {
	const modal = new Modal()
		.setTitle('Add FAQ Link')
		.setCustomId('addFaqModal')

	const faqs = await FAQ.findAll()

	const faqField = new MessageSelectMenu()
		.setCustomId('faqField')
		.setOptions(...faqs.map(faq => {
			return {
				label: faq.name,
				value: faq.title
			} as MessageSelectOptionData
		}))

	const buttonNameField = new TextInputComponent()
		.setCustomId('buttonNameField')
		.setRequired(true)
		.setMaxLength(100)
		.setStyle('SHORT')


	const nameRow = new MessageActionRow<ModalActionRowComponent>().addComponents(buttonNameField)
	// const faqRow = new MessageActionRow<ModalActionRowComponent>().addComponents(faqField)
	modal.addComponents(nameRow)

	return modal
}

export default createAddFAQModal
