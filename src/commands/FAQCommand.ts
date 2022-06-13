import {SlashCommandBuilder} from '@discordjs/builders'
import {
	CommandInteraction,
	GuildMember,
	MessageActionRow,
	Modal,
	ModalActionRowComponent,
	TextInputComponent
} from 'discord.js'
import {Command} from './Commands.js'
import {FAQ} from '../store/models/FAQ.js'
import {createFAQEmbed} from '../listeners/faqListener.js'
import {update} from '../listeners/commandListener.js'
import {MarkedClient} from '../MarkedClient.js'


async function createCommandInfo() {
	const options = await FAQ.findAll()
	const choices = options.map(opt => ({name: opt.name, value: opt.name}))
	return new SlashCommandBuilder()
		.setName('faq')
		.setDescription('Get / set FAQs')
		.addSubcommand(sub => sub
			.setName('get')
			.setDescription('Get a FAQ content')
			.addStringOption(opt => opt
				.setName('name')
				.setDescription('The name of the FAQ')
				.addChoices(...choices)))
		.addSubcommand(sub => sub
			.setName('create')
			.setDescription('Create a new FAQ')
			.addStringOption(opt => opt
				.setName('name')
				.setDescription('The name of the FAQ')))
		.addSubcommand(sub => sub
			.setName('edit')
			.setDescription('Edit an existing FAQ')
			.addStringOption(opt => opt
				.setName('name')
				.setDescription('The name of the FAQ')
				.addChoices(...choices)))
		.addSubcommand(sub => sub
			.setName('delete')
			.setDescription('Delete a  FAQ')
			.addStringOption(opt => opt
				.setName('name')
				.setDescription('The name of the FAQ')
				.addChoices(...choices)))
}

export const FAQCommand: Command = {
	getInfo: createCommandInfo,

	async execute(interaction: CommandInteraction) {
		if (interaction.options.getSubcommand() == 'get') {
			const name = interaction.options.getString('name')
			const faq = await FAQ.findOne({where: {name}})
			if (!faq) {
				await interaction.reply({ephemeral: true, content: 'No FAQ found with this name'})
				return
			}
			await interaction.reply({embeds: [createFAQEmbed(faq, interaction.user, interaction.member as GuildMember ?? undefined)]})
			return
		}
		const member = interaction.member as GuildMember
		if (!member) {
			await interaction.reply({ephemeral: true, content: 'You must be in a guild to use this command'})
			return
		}
		if (!member.permissions.has('MANAGE_MESSAGES')) {
			await interaction.reply({
				ephemeral: true,
				content: 'You must have the Manage Messages permission to use this command'
			})
			return
		}
		if (interaction.options.getSubcommand() == 'create') {
			const name = interaction.options.getString('name')
			const faq = await FAQ.findOne({where: {name}})
			if (faq) {
				await interaction.reply({
					ephemeral: true,
					content: 'A FAQ with this name already exists. Use /faq edit to change it'
				})
				return
			}
			const modal = createFAQModal()

			await interaction.showModal(modal)
			const response = await interaction.awaitModalSubmit({time: 2 ** 31 - 1})
			const title = response.fields.getField('titleField').value
			const content = response.fields.getField('faqContentField').value

			await FAQ.create({name, title, content, author: interaction.user.id})
			await response.reply({ephemeral: true, content: `FAQ named ${name} created`})

			const client = interaction.client as MarkedClient
			await update(client, [this])
			return
		}

		if (interaction.options.getSubcommand() == 'edit') {
			const name = interaction.options.getString('name')
			const faq = await FAQ.findOne({where: {name}})
			if (!faq) {
				await interaction.reply({ephemeral: true, content: 'No FAQ found with this name'})
				return
			}
			const modal = createFAQModal(faq)
			await interaction.showModal(modal)
			const response = await interaction.awaitModalSubmit({time: 2 ** 31 - 1})
			const title = response.fields.getField('titleField').value
			const content = response.fields.getField('faqContentField').value

			await faq.update({title, content})
			await response.reply({ephemeral: true, content: `FAQ named ${name} updated`})
			return
		}

		if (interaction.options.getSubcommand() == 'delete') {
			const name = interaction.options.getString('name')
			const faq = await FAQ.findOne({where: {name}})
			if (!faq) {
				await interaction.reply({ephemeral: true, content: 'No FAQ found with this name'})
				return
			}
			await faq.destroy()
			await interaction.reply({ephemeral: true, content: `FAQ named ${name} deleted`})

			const client = interaction.client as MarkedClient
			await update(client, [this])
			return
		}
	}
}

const createFAQModal = (faq?: FAQ) => {
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