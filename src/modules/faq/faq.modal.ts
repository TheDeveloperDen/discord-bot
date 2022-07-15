import {FAQ} from '../../store/models/FAQ.js'
import {MessageActionRow, Modal, ModalActionRowComponent, TextInputComponent} from 'discord.js'

export const createFaqModal = (faq?: FAQ) => {
	const modal = new Modal()
		.setTitle('FAQ Content')
		.setCustomId('faqContent')

	const titleField = new TextInputComponent()
		.setCustomId('titleField')
		.setLabel('Title')
		.setMaxLength(64)
		.setStyle('SHORT')

	if (faq) {
		titleField.setValue(faq.title)
	}

	const contentField = new TextInputComponent()
		.setCustomId('faqContentField')
		.setLabel('Content')
		.setStyle('PARAGRAPH')

	if (faq) {
		contentField.setValue(faq.content)
	}

	modal.addComponents(new MessageActionRow<ModalActionRowComponent>().addComponents(titleField))
	modal.addComponents(new MessageActionRow<ModalActionRowComponent>().addComponents(contentField))

	return modal
}

export default createFaqModal
