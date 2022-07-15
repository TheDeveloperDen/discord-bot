import {Command, ExecutableSubcommand} from 'djs-slash-helper'
import {ApplicationCommandOptionType, ApplicationCommandType} from 'discord-api-types/v10'
import {getAllCachedResources, getResource, updateAllResources} from './resourcesCache.util.js'
import {GuildMember, MessageEmbedOptions} from 'discord.js'
import {createStandardEmbed, standardFooter} from '../../util/embeds.js'
import {pseudoMention} from '../../util/users.js'
import {moduleManager} from '../../index.js'

const resources: { name: string, value: string }[] = []

async function updateResources() {
	await updateAllResources()
	const result = getAllCachedResources().map(it => ({name: it.name, value: it.name}))
	resources.length = 0
	resources.push(...result)
}

await updateResources()

const extraFooter = '\n\n[Contribute to our resource collection](https://github.com/TheDeveloperDen/LearningResources)'

const LearningGetSubcommand: ExecutableSubcommand = {
	type: ApplicationCommandOptionType.Subcommand,
	name: 'get',
	description: 'Get a learning resource',
	options: [{
		type: ApplicationCommandOptionType.String,
		name: 'resource',
		description: 'The resource to lookup',
		choices: resources,
		required: true
	}],
	async handle(interaction) {
		const name = interaction.options.getString('resource')
		if (!name) return
		const resource = await getResource(name)
		if (!resource) return interaction.reply(`Could not find resource ${name}`)

		const embed: MessageEmbedOptions = {
			...createStandardEmbed(interaction.member as GuildMember ?? undefined),
			title: resource.name,
			footer: {
				...standardFooter(),
				text: `Requested by ${pseudoMention(interaction.user)} | Learning Resources`
			},
			description: `**${resource.description}**\n` +
				resource.resources
					.map(res => {
						const pros = res.pros.length == 0 ? '' : '\n**Pros**\n' + res.pros.map(i => '• ' + i).join('\n')
						const cons = res.cons.length == 0 ? '' : '\n**Cons**\n' + res.cons.map(i => '• ' + i).join('\n')
						const linkedName = `[${res.name}](${res.url})`
						const price = res.price ? `${res.price}` : 'Free!'
						return `${linkedName} - ${price}${pros}${cons}\n`
					}).join('\n')
				+ extraFooter
		}

		await interaction.reply({embeds: [embed]})
	}
}

const LearningUpdateSubcommand: ExecutableSubcommand = {
	type: ApplicationCommandOptionType.Subcommand,
	name: 'update',
	description: 'Update the learning resources cache',
	async handle(interaction) {
		const member = interaction.member as GuildMember
		if (!member.permissions.has('MANAGE_MESSAGES')) return interaction.reply({
			ephemeral: true,
			content: 'No permission'
		})

		await interaction.deferReply({ephemeral: true})
		await updateResources()
		await moduleManager.refreshCommands()
		await interaction.followUp('Updated learning resources cache')
		return
	}
}

const LearningListSubcommand: ExecutableSubcommand = {
	type: ApplicationCommandOptionType.Subcommand,
	name: 'list',
	description: 'List all learning resources',
	options: [],

	async handle(interaction) {
		const resources = getAllCachedResources().map(i => i.name).join(', ')
		const embed: MessageEmbedOptions = {
			...createStandardEmbed(interaction.member as GuildMember ?? undefined),
			title: 'Resource List',
			description: resources + extraFooter,
			footer: {
				...standardFooter(),
				text: `Requested by ${pseudoMention(interaction.user)} | Learning Resources`
			}
		}
		await interaction.reply({ephemeral: true, embeds: [embed]})
	}
}

export const LearningCommand: Command<ApplicationCommandType.ChatInput> = {
	type: ApplicationCommandType.ChatInput,
	name: 'learning',
	description: 'Manage learning resources',
	options: [LearningListSubcommand, LearningGetSubcommand, LearningUpdateSubcommand],
	handle() {
	}
}
