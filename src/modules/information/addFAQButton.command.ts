import {Command} from 'djs-slash-helper'
import {ApplicationCommandType} from 'discord-api-types/v10'
import createAddFAQModal from './addFAQButton.modal.js'


export const AddFAQButtonCommand: Command<ApplicationCommandType.Message> = {
	name: 'Add FAQ Button',
	type: ApplicationCommandType.Message,
	default_permission: false,


	async handle(interaction) {
		// interaction.reply()
		const modal = await createAddFAQModal()
		await interaction.showModal(modal)
	}

}

