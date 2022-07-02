import {Command, ExecutableSubcommand} from 'djs-slash-helper'
import {ApplicationCommandOptionType, ApplicationCommandType} from 'discord-api-types/v10.js'
import {FAQ} from '../../store/models/FAQ.js'
import {createFaqEmbed} from './faq.util.js'
import createFaqModal from './faq.modal.js'

const choices: { name: string, value: string }[] = []

const GetSubcommand: ExecutableSubcommand = {
	type: ApplicationCommandOptionType.Subcommand,
	name: 'get',
	description: 'Get a FAQ entry\'s content',
	options: [{
		type: ApplicationCommandOptionType.String,
		name: 'name',
		description: 'The name of the FAQ',
		required: true,
		choices
	}],
	async handle(interaction) {
		const name = interaction.options.getString('name')
		const faq = await FAQ.findOne({where: {name}})
		if (!faq) return interaction.reply({ephemeral: true, content: 'No FAQ found with this name'})
		return interaction.reply({embeds: [createFaqEmbed(faq)]})
	}
}

const EditSubcommand: ExecutableSubcommand = {
	type: ApplicationCommandOptionType.Subcommand,
	name: 'edit',
	description: 'Edit a FAQ entry, or create a new one if it doesn\'t exist',
	options: [{
		type: ApplicationCommandOptionType.String,
		name: 'name',
		description: 'The name of the FAQ'
	}],
	async handle(interaction) {
		const name = interaction.options.getString('name')
		const faq = await FAQ.findOne({where: {name}})

		const modal = createFaqModal(faq ?? undefined)

		await interaction.showModal(modal)
		const response = await interaction.awaitModalSubmit({time: 2 ** 31 - 1})
		const title = response.fields.getField('titleField').value
		const content = response.fields.getField('faqContentField').value

		await FAQ.upsert({id: faq?.id, name, title, content, author: interaction.user.id})
		await response.reply({ephemeral: true, content: `FAQ named ${name} created`})

		// const client = interaction.client as MarkedClient
		// FIXME - update the client
		// return update(client, [this])
	}
}

const DeleteSubcommand: ExecutableSubcommand = {
	type: ApplicationCommandOptionType.Subcommand,
	name: 'delete',
	description: 'Delete a FAQ entry',
	options: [{
		type: ApplicationCommandOptionType.String,
		name: 'name',
		description: 'The name of the FAQ',
		required: true,
		choices
	}],
	async handle(interaction) {
		const name = interaction.options.getString('name')
		const faq = await FAQ.findOne({where: {name}})
		if (!faq) return interaction.reply({ephemeral: true, content: 'No FAQ found with this name'})
		await faq.destroy()
		return  interaction.reply({ephemeral: true, content: `FAQ named ${name} deleted`})

	}
}

export const FaqCommand: Command<ApplicationCommandType.ChatInput> = {
	name: 'faq',
	description: 'Get / set FAQs',
	type: ApplicationCommandType.ChatInput,
	options: [GetSubcommand, EditSubcommand, DeleteSubcommand],
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	handle() {
	}
}
