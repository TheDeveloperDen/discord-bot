import {SlashCommandBuilder} from '@discordjs/builders'
import {CommandInteraction, GuildMember, MessageEmbedOptions} from 'discord.js'
import {createStandardEmbed, standardFooter} from '../util/embeds.js'
import {Command} from './Commands.js'
import {getAllCachedResources, getResource, updateAllResources} from '../store/learningResourcesCache.js'
import {MarkedClient} from '../MarkedClient.js'
import {update} from '../listeners/commandListener.js'
import {pseudoMention} from '../util/users.js'

async function createCommandInfo() {
	await updateAllResources()
	const resources = (await getAllCachedResources())
		.map(i => ({name: i.name, value: i.name}))

	return new SlashCommandBuilder()
		.setName('learning')
		.setDescription('Manage learning resources')
		.addSubcommand(sub => sub
			.setName('update')
			.setDescription('Update the learning resources cache'))
		.addSubcommand(sub => sub
			.setName('get')
			.setDescription('Get a learning resource')
			.addStringOption(option => option
				.setName('resource')
				.setDescription('The resource to lookup')
				.addChoices(...resources)))
		.addSubcommand(sub => sub
			.setName('list')
			.setDescription('List all learning resources'))
}

export const LearningCommand: Command = {
	getInfo: createCommandInfo,


	async execute(interaction: CommandInteraction) {
		if (interaction.options.getSubcommand() == 'update') {
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
			await interaction.deferReply({ephemeral: true})
			const client = interaction.client as MarkedClient
			await update(client, [this])
			await interaction.followUp('Updated learning resources cache')
			return
		}

		if (interaction.options.getSubcommand() == 'list') {
			const resources = (await getAllCachedResources())
				.map(i => i.name)
				.join(', ')

			const embed: MessageEmbedOptions = {
				...createStandardEmbed(interaction.member as GuildMember ?? undefined),
				title: 'Resource List',
				description: resources + '\n\n[Contribute to our resource collection](https://github.com/TheDeveloperDen/LearningResources)',
				footer: {
					...standardFooter(),
					text: `Requested by ${pseudoMention(interaction.user)} | Learning Resources`
				}
			}
			await interaction.reply({ephemeral: true, embeds: [embed]})
		}

		if (interaction.options.getSubcommand() == 'get') {
			const name = interaction.options.getString('resource')
			if (!name) return
			const resource = await getResource(name)
			if (!resource) return interaction.reply(`Could not find resource ${name}`)

			const embed: MessageEmbedOptions = {
				...createStandardEmbed(interaction.member as GuildMember ?? undefined),
				author: {name: resource.name},
				title: resource.description,
				footer: {
					...standardFooter(),
					text: `Requested by ${pseudoMention(interaction.user)} | Learning Resources`
				},
				description: resource.resources
					.map(res => {
						const pros = res.pros.length == 0 ? '' : '\n**Pros**\n' + res.pros.map(i => '• ' + i).join('\n')
						const cons = res.cons.length == 0 ? '' : '\n**Cons**\n' + res.cons.map(i => '• ' + i).join('\n')
						const linkedName = `[${res.name}](${res.url})`
						const price = res.price ? `${res.price}` : 'Free!'
						return `${linkedName} - ${price}${pros}${cons}\n`
					}).join('\n')
			}

			await interaction.reply({embeds: [embed]})
		}
	}

}