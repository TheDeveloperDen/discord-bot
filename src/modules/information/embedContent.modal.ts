import {MessageActionRow, Modal, ModalActionRowComponent, TextInputComponent} from 'discord.js'

export const createEmbedModal = () => {
	const modal = new Modal()
		.setTitle('Creating Embed Content')
		.setCustomId('embedModal')

	const contentField = new TextInputComponent()
		.setCustomId('contentField')
		.setLabel('JSON Embed Content')
		.setRequired(true)
		.setStyle('PARAGRAPH')

	modal.addComponents(new MessageActionRow<ModalActionRowComponent>().addComponents(contentField))

	return modal
}

export default createEmbedModal
